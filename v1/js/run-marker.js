// WHY: the run marker is the only place a run leaves a mark on the source - the current line while it
//      runs, the failing line when it stops, the passed lines on a solve, and the lines that never ran.
//      Keeping it in its own module means the controller stays a controller: it builds the machine,
//      asks for ticks, and tells this module what happened. The module owns the gutter and the single
//      red bar over the failing line; it never touches the board or the trace.
// PACK: loopworks-app
// 2026-11-14 agent: extracted from app.js so the run marker can be tested and replaced on its own,
//      following the learner's direction to modularise the risky overlay.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  const REASON_ICON = {
    'bump': '\u2715',
    'out of fuel': '\u26A1',
    'too many steps': '\u221E',
    'program ended': '\u25A0'
  };

  function create(gutter, code, bar) {
    let failedLine = 0;
    let currentLine = 0;
    let executionCounts = {};
    let runSolved = false;
    let failureReason = '';
    let guardResults = {};
    let controlLines = {};

    function reset() {
      failedLine = 0;
      currentLine = 0;
      executionCounts = {};
      runSolved = false;
      failureReason = '';
      guardResults = {};
      controlLines = {};
      sync();
    }

    function setCurrent(line) { currentLine = line || 0; sync(); }
    function setFailed(line, reason) { failedLine = line || 0; failureReason = reason || ''; currentLine = 0; sync(); }
    function setSolved() { runSolved = true; currentLine = 0; sync(); }
    function incrementCount(line) { if (line) executionCounts[line] = (executionCounts[line] || 0) + 1; }
    function setGuardResult(line, answer) {
      // WHY: only a guard line carries an answer. An action line reports no answer, so it must not
      //      leave a guard badge behind - a plain "forward" has nothing to be true or false about.
      if (!line || typeof answer !== 'boolean') return;
      if (!guardResults[line]) guardResults[line] = { yes: 0, no: 0 };
      if (answer) guardResults[line].yes += 1;
      else guardResults[line].no += 1;
    }
    function detectControlLines(source) {
      controlLines = {};
      String(source || '').split('\n').forEach((text, i) => {
        const t = text.trim();
        if (/^repeat\s+\d+$/.test(t) || t === 'end') controlLines[i + 1] = t === 'end' ? 'end' : 'repeat';
      });
    }

    function sync() {
      if (!gutter || !code) return;
      // WHY: the module reads the source it marks, so a control line is recognised on every paint -
      //      not only when a run starts. A "repeat" typed but not yet run still shows its loop icon.
      detectControlLines(code.value);
      const count = code.value.split('\n').length;
      const fl = (failedLine >= 1 && failedLine <= count) ? failedLine : 0;
      const cl = (!fl && currentLine >= 1 && currentLine <= count) ? currentLine : 0;
      const solved = (!fl && !cl && runSolved);
      const hasRun = (Object.keys(executionCounts).length > 0);

      if (!fl && !cl && !solved && !hasRun) {
        const numbers = [];
        for (let n = 1; n <= count; n += 1) numbers.push(String(n));
        gutter.textContent = numbers.join('\n');
        gutter.scrollTop = code.scrollTop;
        syncBar(fl, count, code);
        return;
      }

      const html = [];
      for (let n = 1; n <= count; n += 1) {
        let cls = 'gutter-num';
        const cnt = executionCounts[n] || 0;
        let mark = '';
        const isControl = !!controlLines[n];
        if (fl) {
          if (n === fl) { cls += ' gutter-fail'; mark = '<span class="gutter-reason" title="' + (failureReason || 'stopped') + '">' + (REASON_ICON[failureReason] || '\u2715') + '</span>'; }
          else if (n < fl && cnt > 0) cls += ' gutter-pass';
          else if (n > fl) cls += ' gutter-skip';
          else if (isControl) cls += ' gutter-control';
        } else if (cl) {
          if (n === cl) cls += ' gutter-current';
          else if (cnt > 0) cls += ' gutter-pass';
          else if (isControl) cls += ' gutter-control';
          else if (hasRun) cls += ' gutter-skip';
        } else if (solved) {
          if (cnt > 0) { cls += ' gutter-pass'; mark = '<span class="gutter-check">\u2713</span>'; }
          else if (isControl) cls += ' gutter-control';
          else cls += ' gutter-skip';
        } else if (hasRun) {
          if (cnt > 0) cls += ' gutter-pass';
          else if (isControl) cls += ' gutter-control';
          else cls += ' gutter-skip';
        }
        const gr = guardResults[n];
        if (gr && (gr.yes + gr.no) > 0) {
          const total = gr.yes + gr.no;
          const ratio = total > 1 ? gr.yes + '/' + total : (gr.yes > 0 ? '\u2713' : '\u2717');
          mark = '<span class="gutter-guard" title="true: ' + gr.yes + ', false: ' + gr.no + '">' + ratio + '</span>' + mark;
        }
        if (isControl && !fl) {
          const icon = controlLines[n] === 'repeat' ? '\u21bb' : '\u230b';
          mark = '<span class="gutter-control-mark">' + icon + '</span>' + mark;
        }
        const countTag = cnt > 1 ? '<span class="gutter-count">' + cnt + '</span>' : '';
        let label = '';
        if (n === fl) label = failureReason || 'stopped here';
        else if (isControl) label = controlLines[n] === 'repeat' ? 'repeat block' : 'end of repeat';
        else if (cnt > 0) label = solved ? 'passed' : 'ran ' + cnt + (cnt === 1 ? ' time' : ' times');
        else if (hasRun || solved) label = 'never ran';
        html.push('<span class="' + cls + '" title="' + label + '">' + n + countTag + mark + '</span>');
      }
      gutter.innerHTML = html.join('');
      gutter.scrollTop = code.scrollTop;
      syncBar(fl, count, code);
    }

    // WHY: the editor is a plain textarea, so it cannot paint one line by itself. The bar is a single
    //      absolutely-placed strip that sits behind the text (z-index -1) on the line that stopped the
    //      run, and nowhere else. It is measured from the box's own computed line-height and padding,
    //      so it still lands right when a small screen raises the line height, and it follows the
    //      textarea's scroll. It takes no press and hides itself the moment there is no failed line.
    function syncBar(fl, count, code) {
      if (!bar) return;
      if (!fl || fl < 1 || fl > count) { bar.style.display = 'none'; return; }
      const cs = (host.getComputedStyle ? host.getComputedStyle(code) : null);
      const lineHeight = (cs && parseFloat(cs.lineHeight)) || 20;
      const paddingTop = (cs && parseFloat(cs.paddingTop)) || 8;
      bar.style.display = 'block';
      bar.style.top = ((fl - 1) * lineHeight + paddingTop - code.scrollTop) + 'px';
      bar.style.height = lineHeight + 'px';
      bar.style.left = code.offsetLeft + 'px';
    }

    // WHY: the textarea scrolls on its own, so the bar has to be moved without rebuilding the gutter.
    function reposition() {
      if (!bar) return;
      const count = code ? code.value.split('\n').length : 0;
      syncBar(failedLine, count, code);
    }

    return {
      reset, setCurrent, setFailed, setSolved, incrementCount, setGuardResult,
      detectControlLines, sync, reposition,
      get failedLine() { return failedLine; },
      get currentLine() { return currentLine; },
      get executionCounts() { return executionCounts; },
      get runSolved() { return runSolved; },
      get failureReason() { return failureReason; },
      get guardResults() { return guardResults; },
      get controlLines() { return controlLines; },
    };
  }

  host.LoopworksRunMarker = { create };
})();
