import { ExternalTokenizer } from '@lezer/lr';
import { UntilEOL, untilCommentClose } from './glsl.terms';

export const untilEOLToken = new ExternalTokenizer(
  (input, stack) => {
    while (true) {
      const v = input.next;
      // \ + \n
      if (v === 92 && input.peek(1) === 10) input.advance();
      // \n | EOF
      else if (v === 10 || v === -1) return input.acceptToken(UntilEOL);
      input.advance();
    }
  },
);

export const untilCommentCloseToken = new ExternalTokenizer(
  (input, stack) => {
    while (true) {
      // */
      const v = input.next;
      if (v === 42 && input.peek(1) === 47) {
        return input.acceptToken(untilCommentClose, 2);
      }
      input.advance();
    }
  },
);
