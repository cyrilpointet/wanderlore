/**
 * A content reference and the label to show for it. The label comes from the
 * backend — never from the front's translations, never derived from the
 * reference (front spec, principle 2).
 */
export type ContentLabel = {
  reference: string
  label: string
}
