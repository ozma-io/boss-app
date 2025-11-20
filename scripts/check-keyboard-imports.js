#!/usr/bin/env node

/**
 * Pre-build script to ensure keyboard components are imported from react-native-keyboard-controller
 * and not from react-native.
 * 
 * This prevents runtime issues with keyboard handling, especially with inverted FlatLists.
 */

const { execSync } = require('child_process');
const path = require('path');

// Patterns that should NOT be found in the codebase
const forbiddenPatterns = [
  {
    pattern: 'KeyboardAvoidingView.*from.*(react-native["\']|["\']react-native)',
    message: 'KeyboardAvoidingView must be imported from react-native-keyboard-controller, not react-native',
    correctImport: "import { KeyboardAvoidingView } from 'react-native-keyboard-controller';"
  },
  {
    pattern: 'Keyboard\\.(dismiss|addListener)',
    filePattern: '.tsx?',
    excludePattern: 'from.*(react-native-keyboard-controller)',
    message: 'Use KeyboardController from react-native-keyboard-controller instead of Keyboard from react-native',
    correctImport: "import { KeyboardController } from 'react-native-keyboard-controller'; // Use KeyboardController.dismiss()"
  }
];

// Directories to check
const directoriesToCheck = [
  'app',
  'components',
  'contexts',
  'hooks',
  'services',
  'utils'
];

let hasErrors = false;

console.log('🔍 Checking keyboard component imports...\n');

forbiddenPatterns.forEach(({ pattern, message, correctImport, filePattern, excludePattern }) => {
  try {
    // Build grep command arguments
    const args = ['-rn', '-E', pattern, ...directoriesToCheck];
    
    // Add file pattern if specified
    if (filePattern) {
      args.push(`--include=*${filePattern}`);
    }
    
    // Build command with proper escaping
    const cmd = `grep ${args.map(arg => {
      // Escape arguments that might contain special characters
      if (arg.includes(' ') || arg.includes('*') || arg.includes('(') || arg.includes(')')) {
        return `'${arg}'`;
      }
      return arg;
    }).join(' ')}`;
    
    // Execute grep
    const result = execSync(cmd, { 
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    if (result) {
      // Filter out excluded patterns if specified
      let matches = result.split('\n').filter(line => line.trim());
      
      if (excludePattern) {
        // For each match, check the file to see if it has the exclude pattern
        matches = matches.filter(match => {
          const [filePath] = match.split(':');
          try {
            const fileContent = require('fs').readFileSync(
              path.join(__dirname, '..', filePath),
              'utf-8'
            );
            return !new RegExp(excludePattern).test(fileContent);
          } catch {
            return true; // Include if we can't read the file
          }
        });
      }
      
      if (matches.length > 0) {
        hasErrors = true;
        console.error(`❌ ERROR: ${message}\n`);
        console.error('Found in:');
        matches.forEach(line => console.error(`  ${line}`));
        console.error(`\nCorrect usage:\n  ${correctImport}\n`);
      }
    }
  } catch (error) {
    // grep returns exit code 1 when no matches found - this is what we want
    if (error.status === 1) {
      // No matches found - good!
    } else {
      // Real error
      console.error(`Error checking pattern "${pattern}":`, error.message);
    }
  }
});

if (hasErrors) {
  console.error('\n❌ Build failed: Fix the keyboard import errors above.\n');
  process.exit(1);
} else {
  console.log('✅ All keyboard component imports are correct!\n');
  process.exit(0);
}

