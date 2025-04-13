# Contributing to Discord CS:GO Matchmaking Bot

Thank you for your interest in contributing to this project! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in the Issues section
2. If not, create a new issue with a descriptive title
3. Include:
   - Clear steps to reproduce the bug
   - Expected behavior
   - Actual behavior
   - Screenshots if applicable
   - Bot version and environment details

### Suggesting Features

1. Check if the feature has already been suggested in the Issues section
2. If not, create a new issue with a descriptive title prefixed with [Feature]
3. Describe the feature in detail and explain why it would be valuable

### Pull Requests

1. Fork the repository
2. Create a new branch from `main` with a descriptive name
3. Make your changes, following the coding standards
4. Add tests for your changes if applicable
5. Run existing tests to ensure they pass
6. Update documentation if necessary
7. Submit a pull request to the `main` branch

## Development Setup

1. Clone your fork of the repository
2. Install dependencies with `npm install`
3. Create a `.env` file based on `.env.example`
4. Run the bot locally with `node index.js`

## Coding Standards

- Use camelCase for variable and function names
- Use meaningful variable names
- Add comments for complex logic
- Follow the existing code structure
- Keep functions focused on a single responsibility
- Use async/await for asynchronous code

## Testing

- Add tests for new functionality
- Ensure existing tests pass before submitting a pull request
- Test your changes in a Discord server before submitting

## Documentation

- Update documentation when adding or changing features
- Keep README.md up to date
- Document functions with JSDoc comments

## Review Process

Pull requests will be reviewed by maintainers. You may be asked to make changes before your pull request is merged.

Thank you for contributing!
