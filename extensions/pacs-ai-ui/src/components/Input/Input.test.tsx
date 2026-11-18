import React from 'react';
import { render, screen } from '@testing-library/react';
import Input, { PACS_AI_INPUT_CLASSES } from './Input';

// ui-next's cn is tailwind-merge over clsx; the real one, without loading the
// whole ui-next package.
jest.mock('@ohif/ui-next', () => {
  const { twMerge } = jest.requireActual('tailwind-merge');
  const { clsx } = jest.requireActual('clsx');
  return { cn: (...inputs) => twMerge(clsx(inputs)) };
});

const classesOf = (element: HTMLElement) => element.className.split(' ');

describe('PACS-AI Input', () => {
  test('renders the PACS-AI field look', () => {
    render(<Input placeholder="Email address" />);
    const classes = classesOf(screen.getByPlaceholderText('Email address'));
    for (const cls of PACS_AI_INPUT_CLASSES.split(' ')) {
      expect(classes).toContain(cls);
    }
  });

  test('classes passed in win over the defaults', () => {
    render(
      <Input
        placeholder="Search"
        className="mt-2 h-10"
      />
    );
    const classes = classesOf(screen.getByPlaceholderText('Search'));
    expect(classes).toContain('h-10');
    expect(classes).toContain('mt-2');
    expect(classes).not.toContain('h-[51px]');
  });

  test('forwards the ref and input props', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <Input
        ref={ref}
        type="password"
        defaultValue="x"
        disabled
      />
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current.type).toBe('password');
    expect(ref.current.disabled).toBe(true);
  });
});
