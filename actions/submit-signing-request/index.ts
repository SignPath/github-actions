import { Task } from "./task";
import { HelperArtifactDownload } from "./helper-artifact-download";
import { HelperInputOutput } from "./helper-input-output";

const helperInputOutput = new HelperInputOutput();
const helperArtifactDownload = new HelperArtifactDownload(helperInputOutput);
const task = new Task(helperInputOutput, helperArtifactDownload);
task.run();