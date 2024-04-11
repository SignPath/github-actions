// build scripts for the project

var util = require('./make-util');
var fs = require('fs');

var argv = require('minimist')(process.argv.slice(2));


var run = util.run;

var CLI = {};

CLI.build = function(args) {
    run('npm install', true);
    run('npm install', true, 'actions/submit-signing-request');

    run('npm run lint', true);

    run('tsc --rootDir actions');
    run('ncc build index.js -o dist', true, 'actions/submit-signing-request');

    const actionPath = 'actions/submit-signing-request';
    fs.copyFileSync(actionPath + '/README.md', actionPath + '/dist/README.md');
    fs.copyFileSync(actionPath + '/action.yml', actionPath + '/dist/action.yml');
    
    run('npm run test', true);
}

CLI.test = function(args) {
    run('tsc --rootDir actions');
    try {
      run('mocha actions/*/tests/**/*.js --reporter list', /*inheritStreams:*/true);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

var command  = argv._[0];

if (typeof CLI[command] !== 'function') {
  fail('Invalid CLI command: "' + command + '"\r\nValid commands:' + Object.keys(CLI));
}

CLI[command](argv);
