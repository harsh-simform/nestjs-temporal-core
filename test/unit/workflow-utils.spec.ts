import { buildLocalActivityProxyOptions } from '../../src/workflow-utils';
import { LOCAL_ACTIVITY_PRESETS } from '../../src/constants';

describe('buildLocalActivityProxyOptions', () => {
    it('falls back to the STANDARD preset when called with no arguments', () => {
        expect(buildLocalActivityProxyOptions()).toEqual(LOCAL_ACTIVITY_PRESETS.STANDARD);
    });

    it('merges explicit options over the default preset', () => {
        const options = buildLocalActivityProxyOptions({ scheduleToCloseTimeout: '2s' });

        expect(options.scheduleToCloseTimeout).toBe('2s');
        // retry comes through from the STANDARD preset since it wasn't overridden
        expect(options.retry).toEqual(LOCAL_ACTIVITY_PRESETS.STANDARD.retry);
    });

    it('lets explicit options fully override every preset field', () => {
        const options = buildLocalActivityProxyOptions({
            scheduleToCloseTimeout: '1s',
            retry: LOCAL_ACTIVITY_PRESETS.QUICK.retry,
        });

        expect(options).toEqual({
            scheduleToCloseTimeout: '1s',
            retry: LOCAL_ACTIVITY_PRESETS.QUICK.retry,
        });
    });

    it('accepts an explicit defaults argument instead of STANDARD', () => {
        const options = buildLocalActivityProxyOptions({}, LOCAL_ACTIVITY_PRESETS.QUICK);

        expect(options).toEqual(LOCAL_ACTIVITY_PRESETS.QUICK);
    });

    it('does not mutate the preset objects it reads from', () => {
        const options = buildLocalActivityProxyOptions({ scheduleToCloseTimeout: '5s' });
        options.scheduleToCloseTimeout = 'mutated';

        expect(LOCAL_ACTIVITY_PRESETS.STANDARD.scheduleToCloseTimeout).not.toBe('mutated');
    });
});
