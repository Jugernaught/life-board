import { describe, expect, it } from 'vitest'
import { scaleTextInCss } from './textScaleCss'

describe('text size CSS transform', () => {
  it('scales absolute font sizes and fixed line heights', () => {
    expect(scaleTextInCss('.a{font-size:13px}')).toBe('.a{font-size:calc(13px * var(--text-scale, 1))}')
    expect(scaleTextInCss('.b { font-size: 0.875rem; line-height: 18px; }')).toBe('.b { font-size: calc(0.875rem * var(--text-scale, 1)); line-height: calc(18px * var(--text-scale, 1)); }')
    expect(scaleTextInCss('.c{font-size:var(--text-sm);line-height:var(--tw-leading,1.4)}')).toBe('.c{font-size:calc(var(--text-sm) * var(--text-scale, 1));line-height:var(--tw-leading,1.4)}')
  })

  it('leaves relative sizes alone and never lets inputs drop below their floor', () => {
    expect(scaleTextInCss('.d{font-size:0.8em}.e{font-size:inherit}.f{line-height:1.5}')).toBe('.d{font-size:0.8em}.e{font-size:inherit}.f{line-height:1.5}')
    expect(scaleTextInCss('input{font-size:16px !important}')).toBe('input{font-size:max(16px, calc(16px * var(--text-scale, 1))) !important}')
  })
})
