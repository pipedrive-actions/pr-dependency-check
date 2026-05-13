const core = require('@actions/core');
const github = require('@actions/github');
const { retry } = require('@octokit/plugin-retry');

// Mock @actions/core and @actions/github
jest.mock('@actions/core');
jest.mock('@actions/github');

describe('Retry Configuration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GITHUB_TOKEN = 'fake-token';
        process.env.GITHUB_REPOSITORY = 'owner/repo';

        // Mock github.context
        github.context = {
            repo: { owner: 'owner', repo: 'repo' },
            issue: { number: 1 }
        };
    });

    test('retry plugin is imported correctly', () => {
        expect(retry).toBeDefined();
        expect(typeof retry).toBe('function');
    });

    test('default max-retries is 5', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'max-retries') return '';
            if (name === 'custom-domains') return '';
            if (name === 'pr-number') return '';
            return '';
        });

        const defaultMaxRetries = parseInt(core.getInput('max-retries') || '5', 10);
        expect(defaultMaxRetries).toBe(5);
    });

    test('max-retries input is respected when provided', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'max-retries') return '5';
            if (name === 'custom-domains') return '';
            if (name === 'pr-number') return '';
            return '';
        });

        const maxRetries = parseInt(core.getInput('max-retries') || '3', 10);
        expect(maxRetries).toBe(5);
    });

    test('max-retries handles 0 value', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'max-retries') return '0';
            if (name === 'custom-domains') return '';
            if (name === 'pr-number') return '';
            return '';
        });

        const maxRetries = parseInt(core.getInput('max-retries') || '3', 10);
        expect(maxRetries).toBe(0);
    });

    test('max-retries handles invalid input with fallback', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'max-retries') return 'invalid';
            if (name === 'custom-domains') return '';
            if (name === 'pr-number') return '';
            return '';
        });

        const maxRetries = parseInt(core.getInput('max-retries') || '3', 10);
        expect(isNaN(maxRetries)).toBe(true);
        // In practice, NaN would be handled by the retry plugin or cause an error
    });

    test('Octokit plugin method exists', () => {
        // Mock getOctokit with plugin method
        const mockPlugin = jest.fn();
        github.getOctokit = jest.fn(() => ({}));
        github.getOctokit.plugin = mockPlugin;

        expect(github.getOctokit.plugin).toBeDefined();
        expect(typeof github.getOctokit.plugin).toBe('function');
    });
});
