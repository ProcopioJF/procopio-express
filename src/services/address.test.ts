import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidOptionalCep } from './address';

describe('isValidOptionalCep', () => {
  it('accepts an empty CEP', () => {
    assert.equal(isValidOptionalCep(''), true);
  });

  it('accepts a complete CEP with or without formatting', () => {
    assert.equal(isValidOptionalCep('36000000'), true);
    assert.equal(isValidOptionalCep('36000-000'), true);
  });

  it('rejects an incomplete CEP', () => {
    assert.equal(isValidOptionalCep('36000'), false);
  });

  it('rejects a CEP with more than eight digits', () => {
    assert.equal(isValidOptionalCep('360000000'), false);
  });
});
