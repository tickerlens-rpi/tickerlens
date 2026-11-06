import {parseMarkdown} from '../lib/simple_markdown';
import type {InlineSpan} from '../lib/simple_markdown';

function Spans({spans}: {spans: InlineSpan[]}) {
  return (
    <>
      {spans.map((span, index) =>
        span.bold ? (
          <strong key={index}>{span.text}</strong>
        ) : (
          <span key={index}>{span.text}</span>
        ),
      )}
    </>
  );
}

/** Renders an AI answer from the small Markdown subset, never as raw HTML. */
export function AiAnswer({text}: {text: string}) {
  return (
    <div className="ai-answer">
      {parseMarkdown(text).map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return (
              <p key={index} className="ai-answer__heading">
                <Spans spans={block.spans} />
              </p>
            );
          case 'paragraph':
            return (
              <p key={index}>
                <Spans spans={block.spans} />
              </p>
            );
          case 'list': {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Spans spans={item} />
              </li>
            ));
            return block.ordered ? (
              <ol key={index}>{items}</ol>
            ) : (
              <ul key={index}>{items}</ul>
            );
          }
          default: {
            const unreachable: never = block;
            return unreachable;
          }
        }
      })}
    </div>
  );
}
