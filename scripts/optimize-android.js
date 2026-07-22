const fs = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, '..', 'android');
const buildGradlePath = path.join(androidDir, 'app', 'build.gradle');
const gradlePropertiesPath = path.join(androidDir, 'gradle.properties');

console.log('Applying safe performance optimizations for Android build...');

// 1. Modify android/app/build.gradle
if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');

  // Keep ProGuard/R8 obfuscation disabled to guarantee 100% startup stability
  content = content.replace(/def enableProguardInReleaseBuilds = true/g, 'def enableProguardInReleaseBuilds = false');
  content = content.replace(/def enableShrinkResourcesInReleaseBuilds = true/g, 'def enableShrinkResourcesInReleaseBuilds = false');

  // Enable ABI splits for smaller architecture-specific APKs
  content = content.replace(/def enableSeparateBuildPerCPU = false/g, 'def enableSeparateBuildPerCPU = true');

  // Ensure universal APK is also generated alongside split APKs
  if (content.includes('splits {') && !content.includes('universalApk true')) {
    content = content.replace(/abi\s*\{/g, 'abi {\n            universalApk true');
  }

  fs.writeFileSync(buildGradlePath, content, 'utf8');
  console.log('Successfully updated android/app/build.gradle');
} else {
  console.warn('Warning: android/app/build.gradle not found at ' + buildGradlePath);
}

// 2. Modify android/gradle.properties
if (fs.existsSync(gradlePropertiesPath)) {
  let props = fs.readFileSync(gradlePropertiesPath, 'utf8');

  const optimizations = [
    'org.gradle.jvmargs=-Xmx4096m -XX:+UseParallelGC -Dfile.encoding=UTF-8',
    'org.gradle.parallel=true',
    'org.gradle.caching=true',
    'org.gradle.configureondemand=true',
    'kotlin.incremental=true',
    'reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86_64'
  ];

  optimizations.forEach(opt => {
    const key = opt.split('=')[0];
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(props)) {
      props = props.replace(regex, opt);
    } else {
      props += `\n${opt}`;
    }
  });

  fs.writeFileSync(gradlePropertiesPath, props, 'utf8');
  console.log('Successfully updated android/gradle.properties');
} else {
  console.warn('Warning: android/gradle.properties not found at ' + gradlePropertiesPath);
}
