// helpers used in the build script
var ncp = require('child_process');
var process = require('process');

var run = function (cl, inheritStreams, cwd) {

    console.log();
    console.log('> ' + cl);

    var options = {
        cwd: cwd,
        stdio: inheritStreams ? 'inherit' : 'pipe',
    };
    var rc = 0;
    var output;
    try {
        output = ncp.execSync(cl, options);
    }
    catch (err) {
        if (!inheritStreams) {
            console.error(err.output ? err.output.toString() : err.message);
        }

        process.exit(1);
    }

    return (output || '').toString().trim();
}
exports.run = run;