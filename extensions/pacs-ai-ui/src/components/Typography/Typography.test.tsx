import React from 'react';
import { render, screen } from '@testing-library/react';
import Typography from './Typography';

describe('Typography', () => {
  it('renders body text as a white paragraph by default', () => {
    render(<Typography>hello</Typography>);
    const element = screen.getByText('hello');
    expect(element.tagName).toBe('P');
    expect(element.className).toBe('m-0 leading-tight text-base text-white');
  });

  it('maps variants to elements and keeps extra classes and attributes', () => {
    render(
      <Typography
        variant="h6"
        className="font-semibold"
        data-testid="title"
      >
        title
      </Typography>
    );
    const element = screen.getByTestId('title');
    expect(element.tagName).toBe('H6');
    expect(element.className).toBe('m-0 leading-tight text-[20px] text-white font-semibold');
  });

  it('renders the requested component', () => {
    render(
      <Typography
        component="label"
        variant="subtitle"
        htmlFor="field"
      >
        label
      </Typography>
    );
    const element = screen.getByText('label');
    expect(element.tagName).toBe('LABEL');
    expect(element.getAttribute('for')).toBe('field');
  });
});
