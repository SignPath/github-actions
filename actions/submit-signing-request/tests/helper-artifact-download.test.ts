import { assert } from "chai";
import { HelperArtifactDownload } from "../helper-artifact-download"
import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs'
import { HelperInputOutput } from "../helper-input-output";

describe("Artifact path resolving tests", () => {
    before(() => { process.env.GITHUB_WORKSPACE = __dirname; });
    after(() => { process.env.GITHUB_WORKSPACE = undefined; });

    [".", "..", "fake", "fake/path"].forEach(relativePathBase => {
        it("Should resolve relative paths to absolute paths", () => {
            const sut = new HelperArtifactDownload(new HelperInputOutput());
            const dirName = uuid.v4();
            const relativePath = path.join(relativePathBase, dirName);
            const expectedAbsolutePath = path.join(__dirname, relativePath);

            let actualResolvedPath: fs.PathLike = "";
            try {
                // ACT
                actualResolvedPath = sut.resolveOrCreateDirectory(relativePath);

                // ASSERT
                assert.equal(actualResolvedPath, expectedAbsolutePath);
            }
            finally {
                fs.rmSync(actualResolvedPath, { force: true, recursive: true  })
            }
        })
    })

    it("Should detect and recognize absolute paths", () => {
        const sut = new HelperArtifactDownload(new HelperInputOutput());
        const dirName = uuid.v4();
        const expectedAbsolutePath = path.join(__dirname, dirName);

        let actualResolvedPath: fs.PathLike = "";
        try {
            // ACT
            actualResolvedPath = sut.resolveOrCreateDirectory(expectedAbsolutePath);

            // ASSERT
            assert.equal(actualResolvedPath, expectedAbsolutePath);
        }
        finally {
            fs.rmSync(actualResolvedPath, { force: true, recursive: true  })
        }
    })
})