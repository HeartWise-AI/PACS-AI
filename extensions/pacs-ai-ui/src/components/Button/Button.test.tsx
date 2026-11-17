import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Button from './Button';

jest.mock('@ohif/ui-next', () => ({
  Tooltip: ({ children }) => children,
  TooltipTrigger: ({ children }) => children,
  TooltipContent: ({ children }) => children,
}));

describe('Button', () => {
  it('renders the PACS-AI gradient primary button', () => {
    render(<Button onClick={() => {}}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('style')).toContain('linear-gradient(98.05deg');
    expect(button.className).toContain('bg-gray-300');
    expect(button.className).toContain('text-black');
    expect(button.className).toContain('h-[32px]');
    expect(button.getAttribute('data-cy')).toBe('undefined-btn');
  });

  it('does not pass type="submit" to the element and adds no visual-type classes', () => {
    render(
      <Button
        type="submit"
        className="w-full"
      >
        Login
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Login' });
    expect(button.getAttribute('type')).toBeNull();
    expect(button.className).not.toContain('bg-gray-300');
    expect(button.className).toContain('w-full');
  });

  it('calls onClick only when enabled', () => {
    const onClick = jest.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button
        onClick={onClick}
        disabled
      >
        Go
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button.className).toContain('opacity-70');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
