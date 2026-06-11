import { renderToBuffer } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

export async function renderPdfToBuffer(doc: ReactElement): Promise<Buffer> {
  return await renderToBuffer(doc)
}
