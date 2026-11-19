const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root=path.resolve(__dirname,'..');
const environmentFile=path.join(root,'.env');
if(fs.existsSync(environmentFile)&&typeof process.loadEnvFile==='function')process.loadEnvFile(environmentFile);
const result=spawnSync(process.execPath,[require.resolve('next/dist/bin/next'),'build','marketing','--webpack'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
