const fs = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, '..', 'android');
const buildGradlePath = path.join(androidDir, 'app', 'build.gradle');
const gradlePropertiesPath = path.join(androidDir, 'gradle.properties');
const proguardRulesPath = path.join(androidDir, 'app', 'proguard-rules.pro');

console.log('Optimizing Android configuration for minimal APK size and fast build times...');

// 1. Modify android/app/build.gradle
if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');

  // Enable ProGuard / R8 minification & resource shrinking
  content = content.replace(/def enableProguardInReleaseBuilds = false/g, 'def enableProguardInReleaseBuilds = true');
  content = content.replace(/def enableShrinkResourcesInReleaseBuilds = false/g, 'def enableShrinkResourcesInReleaseBuilds = true');

  // Enable ABI splits
  content = content.replace(/def enableSeparateBuildPerCPU = false/g, 'def enableSeparateBuildPerCPU = true');

  // Ensure universal APK is also created alongside split APKs
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
    'android.enableR8.fullMode=true',
    'reactNativeArchitectures=arm64-v8a,armeabi-v7a'
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

// 3. Update proguard-rules.pro
const proguardRules = `
# Proguard / R8 Optimization Rules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.react.**

-keep class expo.modules.** { *; }
-dontwarn expo.modules.**

-keepclasseswithmembernames class * {
    native <methods>;
}
`;

if (fs.existsSync(proguardRulesPath)) {
  fs.appendFileSync(proguardRulesPath, proguardRules, 'utf8');
} else {
  fs.writeFileSync(proguardRulesPath, proguardRules, 'utf8');
}
console.log('Successfully updated proguard-rules.pro');
