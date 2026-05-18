import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function PostBody({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-warm max-w-none text-warm-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="font-serif text-2xl text-warm-700 mt-8 mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="font-serif text-xl text-warm-700 mt-6 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="font-serif text-lg text-warm-700 mt-4 mb-2">{children}</h3>,
          p:  ({ children }) => <p className="text-warm-600 leading-relaxed mb-4">{children}</p>,
          a:  ({ href, children }) => <a href={href} className="text-warm-500 underline hover:text-warm-700">{children}</a>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-4 text-warm-600 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-4 text-warm-600 space-y-1">{children}</ol>,
          img: ({ src, alt }) => <img src={src ?? ''} alt={alt ?? ''} className="rounded-xl my-4 max-w-full" />,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-warm-300 pl-4 italic text-warm-500 my-4">{children}</blockquote>,
          code: ({ children }) => <code className="bg-warm-100 text-warm-700 px-1.5 py-0.5 rounded text-sm">{children}</code>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
