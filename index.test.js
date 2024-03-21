const {getInput, setFailed} = require('@actions/core');
const {getOctokit, context} = require('@actions/github');
const parser = require('conventional-commits-parser');

jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('conventional-commits-parser');

const myModule = require('./index');

beforeEach(() => {
    jest.resetAllMocks();
});
let logMock;
beforeEach(() => {
    logMock = jest.spyOn(console, 'log');
    logMock.mockImplementation(() => {});
});

afterEach(() => {
    logMock.mockRestore();
});

describe('checkConventionalCommits', () => {
    it('should fail when task_types input is missing', async () => {
        getInput.mockReturnValue('');
        await myModule.checkConventionalCommits();
        expect(setFailed).toHaveBeenCalledWith('Missing required input: task_types');
    });

    it('should fail when task_types input is invalid JSON', async () => {
        getInput.mockReturnValue('invalid JSON');
        await myModule.checkConventionalCommits();
        expect(setFailed).toHaveBeenCalledWith('Invalid task_types input. Expecting a JSON array.');
    });
    // ... add more tests as required
});

describe('checkTicketNumber', () => {
    it('should fail when ticket number is missing or invalid', async () => {
        getInput.mockReturnValue('\\d+');
        context.payload = {
            pull_request: { title: 'no number here' }
        };
        await myModule.checkTicketNumber();
        expect(setFailed).toHaveBeenCalledWith('Invalid or missing task number: \'\'. Must match: \\d+');
    });
    // ... add more tests as required
});

describe('applyLabel', () => {
    it('should skip label addition if add_label is set to false', async () => {
        getInput.mockReturnValue('false');
        await myModule.applyLabel({}, {});
        expect(setFailed).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('Skipping label addition as add_label is set to false.');
    });

    it('should fail if custom_labels input is invalid JSON', async () => {
        getInput.mockReturnValueOnce('true').mockReturnValueOnce('invalid JSON');
        await myModule.applyLabel({}, {});
        expect(setFailed).toHaveBeenCalledWith('Invalid custom_labels input. Unable to parse JSON.');
    });
    // ... add more tests as required
});
describe('updateLabels', () => {
    let octokit;

    beforeEach(() => {
        octokit = {
            rest: {
                issues: {
                    listLabelsOnIssue: jest.fn(),
                    removeLabel: jest.fn(),
                    getLabel: jest.fn(),
                    createLabel: jest.fn(),
                    addLabels: jest.fn()
                }
            }
        };
        getOctokit.mockReturnValue(octokit);
    });

    it('should remove all existing labels and add new labels', async () => {
        getInput.mockReturnValue('myToken');
        context.repo = { owner: 'myOwner', repo: 'myRepo' };
        octokit.rest.issues.listLabelsOnIssue.mockResolvedValue({ data: [{ name: 'oldLabel' }] });
        octokit.rest.issues.getLabel.mockRejectedValue(new Error());

        const pr = { number: 123 };
        const cc = { type: 'myType', breaking: false };
        const customLabels = {};

        await myModule.updateLabels(pr, cc, customLabels);

        expect(octokit.rest.issues.removeLabel).toHaveBeenCalledWith({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: pr.number,
            name: 'oldLabel'
        });

        expect(octokit.rest.issues.createLabel).toHaveBeenCalledWith({
            owner: context.repo.owner,
            repo: context.repo.repo,
            name: 'myType',
            color: expect.any(String)
        });

        expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: pr.number,
            labels: ['myType']
        });
    });

    // ... add more tests as required
});

describe('generateColor', () => {
    it('should return a string', () => {
        expect(typeof myModule.generateColor('test')).toBe('string');
    });

    it('should generate different colors for different inputs', () => {
        const color1 = myModule.generateColor('test1');
        const color2 = myModule.generateColor('test2');
        expect(color1).not.toEqual(color2);
    });
});

describe('breakingChanges', () => {
    it('should detect ! after scope', async () => {
        getInput.mockReturnValue('["feat", "fix"]')
        context.repo = {owner: 'myOwner', repo: 'myRepo'};
        context.payload = {
            pull_request: {title: 'feat(ui)!: I broke it'}
        };
        parser.sync.mockReturnValue({type: "feat", notes: [""]})
        const pr = {number: 123};
        //const cc = {type: 'feat!', breaking: false};
        const customLabels = {};

        let result = await myModule.checkConventionalCommits();
        //expect(setFailed).toHaveBeenCalledWith('Invalid task_types input. Expecting a JSON array.');
        expect(setFailed).not.toHaveBeenCalled();
        expect(result.breaking).toEqual(true);

    });
})