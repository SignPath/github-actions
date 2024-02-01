import { Task } from "./task";
import { HelperArtifactDownload } from "./helper-artifact-download";
import { HelperInputOutput } from "./helper-input-output";
import { Config } from "./config";

const helperInputOutput = new HelperInputOutput();
const helperArtifactDownload = new HelperArtifactDownload(helperInputOutput);
const config = new Config();
const task = new Task(helperInputOutput, helperArtifactDownload, config);
task.run();