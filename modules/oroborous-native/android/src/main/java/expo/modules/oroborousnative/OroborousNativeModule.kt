package expo.modules.oroborousnative

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.BufferedReader
import java.io.InputStreamReader

class OroborousNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OroborousNative")

    AsyncFunction("executeCommand") { command: String, dir: String ->
      try {
        val workDir = if (dir.isNotEmpty() && File(dir).exists()) File(dir) else File("/")
        val process = ProcessBuilder("/system/bin/sh", "-c", command)
          .directory(workDir)
          .start()

        val stdoutReader = BufferedReader(InputStreamReader(process.inputStream))
        val stderrReader = BufferedReader(InputStreamReader(process.errorStream))

        val stdout = StringBuilder()
        var line: String?
        while (stdoutReader.readLine().also { line = it } != null) {
          stdout.append(line).append("\n")
        }

        val stderr = StringBuilder()
        while (stderrReader.readLine().also { line = it } != null) {
          stderr.append(line).append("\n")
        }

        val exitCode = process.waitFor()

        mapOf(
          "code" to exitCode,
          "stdout" to stdout.toString(),
          "stderr" to stderr.toString()
        )
      } catch (e: Throwable) {
        mapOf(
          "code" to -1,
          "stdout" to "",
          "stderr" to (e.message ?: "Unknown error")
        )
      }
    }

    AsyncFunction("getGitStatus") { dir: String ->
      try {
        val dirFile = File(dir)
        if (!dirFile.exists() || !dirFile.isDirectory) {
          return@AsyncFunction mapOf("isGit" to false, "error" to "Directory does not exist")
        }

        val isGitRes = runCommand("git rev-parse --is-inside-work-tree", dir)
        if (isGitRes.first != 0) {
          return@AsyncFunction mapOf("isGit" to false, "message" to "Not a git repository")
        }

        val branchRes = runCommand("git rev-parse --abbrev-ref HEAD", dir)
        val branch = branchRes.second.trim()

        val statusRes = runCommand("git status --short", dir)
        val statusShort = statusRes.second

        var ahead = 0
        var behind = 0
        val upstreamRes = runCommand("git rev-parse --abbrev-ref @{u}", dir)
        if (upstreamRes.first == 0) {
          val upstream = upstreamRes.second.trim()
          val countRes = runCommand("git rev-list --left-right --count $upstream...HEAD", dir)
          if (countRes.first == 0) {
            val parts = countRes.second.trim().split("\\s+".toRegex())
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
          "path" to dir
        )
      } catch (e: Throwable) {
        mapOf(
          "isGit" to false,
          "error" to (e.message ?: "Unknown error")
        )
      }
    }

    AsyncFunction("getGitDiff") { dir: String, file: String? ->
      try {
        val diffCmd = if (file.isNullOrEmpty()) "git diff HEAD" else "git diff HEAD -- \"$file\""
        val res = runCommand(diffCmd, dir)
        mapOf(
          "diff" to (if (res.second.isNotEmpty()) res.second else res.third)
        )
      } catch (e: Throwable) {
        mapOf(
          "diff" to "Error generating diff: ${e.message}"
        )
      }
    }

    AsyncFunction("validateDirectory") { dirPath: String ->
      try {
        val file = File(dirPath)
        val exists = file.exists()
        val isDir = file.isDirectory
        mapOf(
          "exists" to exists,
          "isDirectory" to isDir,
          "absolutePath" to file.absolutePath,
          "name" to file.name
        )
      } catch (e: Throwable) {
        mapOf(
          "exists" to false,
          "isDirectory" to false,
          "error" to (e.message ?: "Unknown error")
        )
      }
    }

    AsyncFunction("readConfigFile") { fileName: String ->
      try {
        val targetDir = appContext.reactContext?.filesDir ?: appContext.reactContext?.applicationContext?.filesDir
        if (targetDir == null) return@AsyncFunction ""
        val file = File(targetDir, fileName)
        if (file.exists()) {
          file.readText()
        } else {
          ""
        }
      } catch (e: Throwable) {
        ""
      }
    }

    AsyncFunction("writeConfigFile") { fileName: String, content: String ->
      try {
        val targetDir = appContext.reactContext?.filesDir ?: appContext.reactContext?.applicationContext?.filesDir
        if (targetDir == null) return@AsyncFunction false
        val file = File(targetDir, fileName)
        file.writeText(content)
        true
      } catch (e: Throwable) {
        false
      }
    }

    AsyncFunction("readFileContent") { dir: String, filePath: String ->
      try {
        val file = File(dir, filePath)
        if (file.exists() && file.isFile) {
          file.readText()
        } else {
          "Error: File not found or is not a file"
        }
      } catch (e: Throwable) {
        "Error: ${e.message}"
      }
    }

    AsyncFunction("writeFileContent") { dir: String, filePath: String, content: String ->
      try {
        val file = File(dir, filePath)
        val parent = file.parentFile
        if (parent != null && !parent.exists()) {
          parent.mkdirs()
        }
        file.writeText(content)
        true
      } catch (e: Throwable) {
        false
      }
    }

    AsyncFunction("listFiles") { dir: String ->
      try {
        val dirFile = File(dir)
        if (!dirFile.exists()) return@AsyncFunction emptyList<String>()
        val results = mutableListOf<String>()
        
        fun walk(current: File) {
          val list = current.listFiles() ?: return
          for (file in list) {
            val name = file.name
            if (name == "node_modules" || name == ".git" || name == ".expo" || name == ".venv") continue
            if (file.isDirectory) {
              walk(file)
            } else {
              results.add(file.relativeTo(dirFile).path)
            }
          }
        }
        
        walk(dirFile)
        results
      } catch (e: Throwable) {
        emptyList<String>()
      }
    }
  }

  private fun runCommand(cmd: String, dir: String): Triple<Int, String, String> {
    return try {
      val workDir = if (dir.isNotEmpty() && File(dir).exists()) File(dir) else File("/")
      val process = ProcessBuilder("/system/bin/sh", "-c", cmd)
        .directory(workDir)
        .start()

      val stdoutReader = BufferedReader(InputStreamReader(process.inputStream))
      val stderrReader = BufferedReader(InputStreamReader(process.errorStream))

      val stdout = StringBuilder()
      var line: String?
      while (stdoutReader.readLine().also { line = it } != null) {
        stdout.append(line).append("\n")
      }

      val stderr = StringBuilder()
      while (stderrReader.readLine().also { line = it } != null) {
        stderr.append(line).append("\n")
      }

      val exitCode = process.waitFor()
      Triple(exitCode, stdout.toString(), stderr.toString())
    } catch (e: Throwable) {
      Triple(-1, "", e.message ?: "Error executing command")
    }
  }
}
