package expo.modules.oroborousnative

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.TimeUnit

class OroborousNativeModule : Module() {
  companion object {
    // Mirrors server IGNORED_DIRS + secret denylist so native mode has parity
    private val IGNORED_DIRS = setOf(
      "node_modules", ".git", ".expo", ".venv", "venv", "__pycache__",
      ".next", ".nuxt", "dist", "build", "out", ".idea", ".vscode",
      ".gradle", "target", "vendor", ".turbo", ".cache"
    )
    private const val MAX_OUTPUT_CHARS = 512_000L
    private const val COMMAND_TIMEOUT_MS = 30_000L
  }

  override fun definition() = ModuleDefinition {
    Name("OroborousNative")

    AsyncFunction("executeCommand") { command: String, dir: String ->
      executeShell(command, if (dir.isNotEmpty()) File(dir) else File("/"))
    }

    AsyncFunction("getGitStatus") { dir: String ->
      try {
        val dirFile = File(dir)
        if (!dirFile.exists() || !dirFile.isDirectory) {
          return@AsyncFunction mapOf("isGit" to false, "error" to "Directory does not exist")
        }

        val isGitRes = runProcess(listOf("git", "rev-parse", "--is-inside-work-tree"), dir)
        if (isGitRes.first != 0) {
          return@AsyncFunction mapOf("isGit" to false, "message" to "Not a git repository")
        }

        val branchRes = runProcess(listOf("git", "rev-parse", "--abbrev-ref", "HEAD"), dir)
        val branch = branchRes.second.trim()

        val statusRes = runProcess(listOf("git", "status", "--porcelain"), dir)
        val statusShort = statusRes.second

        val stagedFiles = mutableListOf<Map<String, String>>()
        val unstagedFiles = mutableListOf<Map<String, String>>()
        val untrackedFiles = mutableListOf<Map<String, String>>()

        statusShort.lines().filter { it.isNotBlank() }.forEach { line ->
          if (line.length < 4) return@forEach
          val x = line[0]
          val y = line[1]
          var filepath = line.substring(3).trim()
          val arrowIdx = filepath.indexOf(" -> ")
          if (arrowIdx != -1) filepath = filepath.substring(arrowIdx + 4).trim()
          filepath = filepath.trim('"')

          if (x != ' ' && x != '?') stagedFiles.add(mapOf("file" to filepath, "status" to x.toString()))
          if (y != ' ' && y != '?') unstagedFiles.add(mapOf("file" to filepath, "status" to y.toString()))
          if (x == '?' && y == '?') untrackedFiles.add(mapOf("file" to filepath, "status" to "?"))
        }

        var ahead = 0
        var behind = 0
        val upstreamRes = runProcess(listOf("git", "rev-parse", "--abbrev-ref", "@{u}"), dir)
        if (upstreamRes.first == 0) {
          val upstream = upstreamRes.second.trim()
          val countRes = runProcess(
            listOf("git", "rev-list", "--left-right", "--count", "$upstream...HEAD"), dir
          )
          if (countRes.first == 0) {
            val parts = countRes.second.trim().split(Regex("\\s+"))
            if (parts.size == 2) {
              behind = parts[0].toIntOrNull() ?: 0
              ahead = parts[1].toIntOrNull() ?: 0
            }
          }
        }

        mapOf(
          "isGit" to true,
          "branch" to branch,
          "ahead" to ahead,
          "behind" to behind,
          "statusShort" to statusShort,
          "stagedFiles" to stagedFiles,
          "unstagedFiles" to unstagedFiles,
          "untrackedFiles" to untrackedFiles,
          "totalChanges" to (stagedFiles.size + unstagedFiles.size + untrackedFiles.size),
          "path" to dir
        )
      } catch (e: Throwable) {
        mapOf("isGit" to false, "error" to (e.message ?: "Unknown error"))
      }
    }

    AsyncFunction("getGitDiff") { dir: String, file: String? ->
      try {
        val args = mutableListOf("diff")
        args.add("HEAD")
        if (!file.isNullOrEmpty()) {
          require(!file.contains("..") && !file.startsWith("-")) { "Invalid file path" }
          args.add("--"); args.add(file)
        }
        val res = runProcess(listOf("git", *args.toTypedArray()), dir)
        mapOf("diff" to res.second.ifEmpty { res.third })
      } catch (e: Throwable) {
        mapOf("diff" to "Error generating diff: ${e.message}")
      }
    }

    AsyncFunction("validateDirectory") { dirPath: String ->
      try {
        val file = File(dirPath)
        mapOf(
          "exists" to file.exists(),
          "isDirectory" to file.isDirectory,
          "absolutePath" to file.absolutePath,
          "name" to file.name
        )
      } catch (e: Throwable) {
        mapOf("exists" to false, "isDirectory" to false, "error" to (e.message ?: "Unknown error"))
      }
    }

    AsyncFunction("readConfigFile") { fileName: String ->
      try {
        val targetDir = appContext.reactContext?.filesDir ?: return@AsyncFunction ""
        require(fileName == File(fileName).name) { "Invalid config filename" }
        val file = File(targetDir, fileName)
        if (file.exists()) file.readText() else ""
      } catch (e: Throwable) {
        throw RuntimeException("readConfigFile failed: ${e.message}", e)
      }
    }

    AsyncFunction("writeConfigFile") { fileName: String, content: String ->
      try {
        val targetDir = appContext.reactContext?.filesDir ?: throw RuntimeException("filesDir unavailable")
        require(fileName == File(fileName).name) { "Invalid config filename" }
        File(targetDir, fileName).writeText(content)
        true
      } catch (e: Throwable) {
        throw RuntimeException("writeConfigFile failed: ${e.message}", e)
      }
    }

    AsyncFunction("readFileContent") { dir: String, filePath: String ->
      val root = File(dir).canonicalFile
      val target = containedResolve(root, filePath)
        ?: throw RuntimeException("Path escapes workspace: $filePath")
      if (!target.exists() || !target.isFile) {
        throw RuntimeException("File not found or is not a file: $filePath")
      }
      target.readText()
    }

    AsyncFunction("writeFileContent") { dir: String, filePath: String, content: String ->
      val root = File(dir).canonicalFile
      val target = containedResolve(root, filePath)
        ?: throw RuntimeException("Path escapes workspace: $filePath")
      target.parentFile?.mkdirs()
      target.writeText(content)
      true
    }

    AsyncFunction("listFiles") { dir: String ->
      try {
        val dirFile = File(dir)
        if (!dirFile.exists()) return@AsyncFunction emptyList<String>()
        val results = mutableListOf<String>()
        val maxResults = 20_000

        fun walk(current: File, depth: Int) {
          if (depth > 12 || results.size >= maxResults) return
          val list = current.listFiles() ?: return
          for (file in list.sortedBy { it.name }) {
            if (results.size >= maxResults) return
            val name = file.name
            if (IGNORED_DIRS.contains(name)) continue
            if (name.startsWith(".")) continue
            if (file.isDirectory) {
              walk(file, depth + 1)
            } else {
              results.add(file.relativeTo(dirFile).path.replace('\\', '/'))
            }
          }
        }

        walk(dirFile, 0)
        results
      } catch (e: Throwable) {
        throw RuntimeException("listFiles failed: ${e.message}", e)
      }
    }
  }

  // Resolve a workspace-relative path and guarantee it stays inside root.
  private fun containedResolve(root: File, relativePath: String): File? {
    val candidate = File(root, relativePath.removePrefix("/"))
    val canonicalRoot = root.canonicalPath
    val canonicalCandidate = try { candidate.canonicalFile.canonicalPath } catch (_) { candidate.absolutePath }
    return if (canonicalCandidate == canonicalRoot ||
      canonicalCandidate.startsWith(canonicalRoot + File.separator)) {
      candidate
    } else null
  }

  /**
   * Runs a command with argument arrays (no shell), merging stderr into stdout
   * to prevent pipe-buffer deadlocks, capping accumulated output, and enforcing
   * a hard timeout with destroyForcibly().
   */
  private fun runProcess(args: List<String>, workDir: String): Triple<Int, String, String> {
    return try {
      val pb = ProcessBuilder(*args.toTypedArray())
        .directory(File(workDir))
        .redirectErrorStream(true)
      val process = pb.start()

      val output = StringBuilder()
      process.inputStream.bufferedReader().useLines { lines ->
        for (line in lines) {
          // Keep draining until EOF (prevents deadlocks/SIGPIPE) but cap memory
          if (output.length < MAX_OUTPUT_CHARS) {
            output.append(line).append('\n')
          }
        }
      }

      val finished = process.waitFor(COMMAND_TIMEOUT_MS, TimeUnit.MILLISECONDS)
      if (!finished) {
        process.destroyForcibly()
        return Triple(-1, output.toString(), "Process timed out after ${COMMAND_TIMEOUT_MS}ms")
      }

      Triple(process.exitValue(), output.toString(), "")
    } catch (e: Throwable) {
      Triple(-1, "", e.message ?: "Error executing command")
    }
  }

  /** Shell execution for the interactive terminal. Same hardening as runProcess. */
  private fun executeShell(command: String, workDir: File): Map<String, Any> {
    return try {
      val pb = ProcessBuilder("/system/bin/sh", "-c", command)
        .directory(if (workDir.exists()) workDir else File("/"))
        .redirectErrorStream(true)
      val process = pb.start()

      val stdout = StringBuilder()
      process.inputStream.bufferedReader().useLines { lines ->
        for (line in lines) {
          if (stdout.length < MAX_OUTPUT_CHARS) {
            stdout.append(line).append('\n')
          }
        }
      }

      val finished = process.waitFor(COMMAND_TIMEOUT_MS, TimeUnit.MILLISECONDS)
      if (!finished) {
        process.destroyForcibly()
        return mapOf(
          "code" to -1,
          "stdout" to stdout.toString(),
          "stderr" to "Process timed out after ${COMMAND_TIMEOUT_MS}ms"
        )
      }

      mapOf(
        "code" to process.exitValue(),
        "stdout" to stdout.toString(),
        "stderr" to ""
      )
    } catch (e: Throwable) {
      mapOf("code" to -1, "stdout" to "", "stderr" to (e.message ?: "Unknown error"))
    }
  }
}
