import React from 'react';
import { render } from '@testing-library/react';
import { PacsAiThumbnail } from './PacsAiThumbnail';

jest.mock('react-dnd', () => ({ useDrag: () => [{}, () => {}, () => {}] }));
jest.mock('@ohif/ui-next', () => {
  const Pass = ({ children }) => <>{children}</>;
  return {
    Icons: new Proxy({}, { get: () => () => null }),
    DisplaySetMessageListTooltip: () => null,
    Tooltip: Pass,
    TooltipTrigger: Pass,
    TooltipContent: () => null,
  };
});

const baseProps = {
  displaySetInstanceUID: 'ds-1',
  description: 'LAO 30',
  seriesNumber: 3,
  numInstances: 40,
  modality: 'XA',
  thumbnailType: 'thumbnail',
  onClick: () => {},
  onDoubleClick: () => {},
};

describe('PacsAiThumbnail', () => {
  it.each(['thumbnails', 'list'])('shows the selected-view badge in %s view', viewPreset => {
    const { container } = render(
      <PacsAiThumbnail
        {...(baseProps as any)}
        viewPreset={viewPreset}
        selectedViewBadge={{ number: 2, label: 'View 2 used by Model' }}
      />
    );
    const badge = container.querySelector('[data-cy="thumbnail-selected-view-badge"]');
    expect(badge.textContent).toBe('2');
    expect(badge.getAttribute('title')).toBe('View 2 used by Model');
  });

  it('shows no badge without a selected view', () => {
    const { container } = render(<PacsAiThumbnail {...(baseProps as any)} />);
    expect(container.querySelector('[data-cy="thumbnail-selected-view-badge"]')).toBeNull();
    expect(container.querySelector('#thumbnail-ds-1')).not.toBeNull();
  });
});
