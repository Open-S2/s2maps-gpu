import { ExternalTokenizer } from '@lezer/lr';
import { untilEOL, untilCommentClose } from './wgsl.terms';

export const untilEOLToken = new ExternalTokenizer(
  (input, stack) => {
    while (true) {
      const v = input.next;
      // \n\r\v\f | EOF
      if (v === 10 || v === 11 || v === 12 || v === 13 || v === -1) return input.acceptToken(untilEOL);
      input.advance();
    }
  },
);

export const untilCommentCloseToken = new ExternalTokenizer(
  (input, stack) => {
    // WGSL has block comment nesting
    let nesting = 1;
    while (true) {
      const v = input.next;
      if (v === -1) break;

      // /*
      if (v === 47 && input.peek(1) === 42) {
        nesting++;
        input.advance();          
        input.advance();          
      }
      // */
      else if (v === 42 && input.peek(1) === 47) {
        nesting--;
        if (nesting === 0) return input.acceptToken(untilCommentClose, 2);
        else {
          input.advance();          
          input.advance();          
        }
      }
      else {
        input.advance();
      }
    }
  }
);