import DOMPurify from 'dompurify'

export const isValidAttribute = DOMPurify.isValidAttribute
  ? DOMPurify.isValidAttribute.bind(DOMPurify)
  : () => true

export default function sanitize (html, config, disableHtml) {
  if (disableHtml) {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  return DOMPurify.sanitize(html, config)
}
