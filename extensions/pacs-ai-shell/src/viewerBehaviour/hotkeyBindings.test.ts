// OHIF's default bindings, from @ohif/core's sources (the package entry is its
// build output, absent in unit tests).
import defaultBindings from '@ohif/core/src/defaults/hotkeyBindings';
import { applyPacsAiHotkeys, withPacsAiHotkeys } from './hotkeyBindings';

const keysOf = (bindings, commandName, direction?) =>
  bindings.find(
    binding =>
      binding.commandName === commandName &&
      (direction === undefined || binding.commandOptions?.direction === direction)
  )?.keys;

describe('PACS-AI hotkeys', () => {
  test('arrow keys change the series and page keys the image', () => {
    const bindings = withPacsAiHotkeys(defaultBindings as any[]);
    expect(keysOf(bindings, 'updateViewportDisplaySet', -1)).toEqual(['up']);
    expect(keysOf(bindings, 'updateViewportDisplaySet', 1)).toEqual(['down']);
    expect(keysOf(bindings, 'previousImage')).toEqual(['pageup']);
    expect(keysOf(bindings, 'nextImage')).toEqual(['pagedown']);
  });

  test('no two bindings share the swapped keys and the others are unchanged', () => {
    const bindings = withPacsAiHotkeys(defaultBindings as any[]);
    ['up', 'down', 'pageup', 'pagedown'].forEach(key => {
      expect(bindings.filter(binding => binding.keys?.includes(key))).toHaveLength(1);
    });
    const untouched = (defaultBindings as any[]).filter(
      binding => !['updateViewportDisplaySet', 'previousImage', 'nextImage'].includes(binding.commandName)
    );
    untouched.forEach(binding => expect(bindings).toContain(binding));
    expect(bindings).toHaveLength((defaultBindings as any[]).length);
  });

  test("keeps OHIF 3.13's `esc` binding (cancelActiveOperation) and uses no key of its own there", () => {
    const bindings = withPacsAiHotkeys(defaultBindings as any[]);
    const esc = bindings.filter(binding => binding.keys?.includes('esc'));
    expect(esc.map(binding => binding.commandName)).toEqual(['cancelActiveOperation']);
  });

  test('is idempotent and does not change its input', () => {
    const before = JSON.stringify(defaultBindings);
    const once = withPacsAiHotkeys(defaultBindings as any[]);
    expect(withPacsAiHotkeys(once)).toEqual(once);
    expect(JSON.stringify(defaultBindings)).toBe(before);
  });

  test('sets the bindings for the current mode through the customization service', () => {
    const customizationService = {
      Scope: { Mode: 'mode' },
      getCustomization: jest.fn(() => defaultBindings),
      setCustomizations: jest.fn(),
    };
    applyPacsAiHotkeys(customizationService);
    expect(customizationService.getCustomization).toHaveBeenCalledWith('ohif.hotkeyBindings');
    const [values, scope] = customizationService.setCustomizations.mock.calls[0];
    expect(scope).toBe('mode');
    expect(keysOf(values['ohif.hotkeyBindings'].$set, 'nextImage')).toEqual(['pagedown']);
  });

  test('does nothing without bindings to change', () => {
    const customizationService = {
      Scope: { Mode: 'mode' },
      getCustomization: jest.fn(() => undefined),
      setCustomizations: jest.fn(),
    };
    applyPacsAiHotkeys(customizationService);
    applyPacsAiHotkeys(undefined);
    expect(customizationService.setCustomizations).not.toHaveBeenCalled();
  });
});
