#!/bin/bash

# Exit on any error
set -e

# Run type checking
echo "Running type check..."
npm run typecheck

# Run linting
echo "Running linter..."
npm run lint

# Run unit tests
echo "Running unit tests..."
npm test

# Run integration tests
echo "Running integration tests..."
npm run test:integration

# Run E2E tests
echo "Running E2E tests..."
npm run test:e2e

# Run security audit
echo "Running security audit..."
npm audit

# Check test coverage
echo "Checking test coverage..."
if ! npm run test:coverage | grep -q "All files.*|.*80.*|.*80.*|.*80.*|.*80"; then
  echo "Test coverage is below 80%"
  exit 1
fi

# Check bundle size
echo "Checking bundle size..."
npm run analyze-bundle

echo "All pre-deployment checks passed!"
