const { exec } = require('child_process');

// Run tsc to compile TypeScript files
exec('npx tsc server/services/openai.ts --outDir dist --esModuleInterop true --module commonjs', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.log('TypeScript compilation completed');
  
  // Now run the test
  require('./test-anthropic.js');
}); 