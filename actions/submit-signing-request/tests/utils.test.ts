import { assert, expect } from "chai";
import { executeWithRetries } from "../utils";

it('test execute with retries, eventually successful', async () => {
    let counter = 0;
    const promise = async () => {
        counter++;

        if (counter < 3) {
            throw new Error('error');
        }

        return 'success';
    };

    const result = await executeWithRetries(promise, 100, 1, 3);

    expect(result).to.eq('success');
});

/// the test checks that error will be thrown if the promise always fails
it('test execute with retries - error', async () => {
    const promise = async () => {
        throw new Error('error');
    };

    try {
        await executeWithRetries(promise, 25, 1, 3);
        assert.fail('error should be thrown');
    }
    catch (err: any) {
        expect(err.message).to.eq('error');
    }
});