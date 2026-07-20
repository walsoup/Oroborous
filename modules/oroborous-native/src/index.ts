import { requireNativeModule } from 'expo-modules-core';

let OroborousNative: any;
try {
  OroborousNative = requireNativeModule('OroborousNative');
} catch (e) {
  // Fallback for non-Android / Web platforms where native module isn't available
  OroborousNative = null;
}

export default OroborousNative;
