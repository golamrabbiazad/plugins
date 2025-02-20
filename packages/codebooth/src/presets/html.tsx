import {css} from "@codemirror/lang-css";
import {html} from "@codemirror/lang-html";
import {javascript} from "@codemirror/lang-javascript";
import {Extension} from "@codemirror/state";
import {CodeRecording} from "@lqv/codemirror/recording";
import {useEffect, useRef} from "react";
import {useStore} from "zustand";
import {CodeBooth} from "..";
import {Buttons, Clear, Copy, Reset, Run, Tab, TabList} from "../components/buttons";
import {Console} from "../components/Console";
import {Editor} from "../components/Editor";
import {EditorGroup} from "../components/EditorGroup";
import {EditorPanel} from "../components/EditorPanel";
import {FileTabs} from "../components/FileTabs";
import {Record} from "../components/Record";
import {Replay, ReplayMultiple} from "../components/Replay";
import {Resize} from "../components/Resize";
import {basicSetup} from "../extensions";
import {State, useBoothStore} from "../store";

/** HTML demo */
export function HTMLDemo(props: {
  /**
   * CodeMirror extensions to add.
   * @default []
   */
  extensions?: Extension[];

  /**
   * Map of filenames to file contents.
   */
  files: Record<string, string>;
}) {
  const {extensions = []} = props;

  return (
    <CodeBooth>
      <FileTabs />
      {Object.keys(props.files).map(filename =>
        <EditorPanel filename={filename} key={filename}>
          <Editor content={props.files[filename]} extensions={[basicSetup, extensionFromFilename(filename), ...extensions]} />
        </EditorPanel>
      )}
      <Resize />
      <Resize dir="ns" />
      <HTMLPreview />
      <Console />
      <Buttons>
        <Reset />
        <Run />
        <Clear />
      </Buttons>
    </CodeBooth>
  );
}

/** Interactive HTML replay. */
export const HTMLReplay: React.FC<{
  /**
   * CodeMirror extensions to add.
   * @default []
   */
  extensions?: Extension[];

  /** Map of filenames to file contents. */
  files: Record<string, string>;

  /** Coding data to replay. */
  replay: React.ComponentProps<typeof ReplayMultiple>["replay"];

  /**
   * When replay should start.
   * @default 0
   */
  start?: number;
}> = (props) => {
  const {extensions = []} = props;

  return (
    <CodeBooth>
      <FileTabs />
      <EditorGroup id="replay">
        {Object.keys(props.files).map(filename =>
          <EditorPanel filename={filename} key={filename}>
            <Replay content={props.files[filename]} extensions={[basicSetup, extensionFromFilename(filename), ...extensions]} />
          </EditorPanel>
        )}
        <ReplayMultiple replay={props.replay} start={props.start} />
      </EditorGroup>
      <EditorGroup id="playground">
        {Object.keys(props.files).map(filename =>
          <EditorPanel filename={filename} key={filename}>
            <Editor extensions={[basicSetup, extensionFromFilename(filename), ...extensions]} />
          </EditorPanel>
        )}
      </EditorGroup>
      <Resize />
      <Resize dir="ns" />
      <HTMLPreview />
      <Console />
      <Buttons>
        <TabList>
          <Tab id="replay">Replay</Tab>
          <Tab id="playground">Playground</Tab>
        </TabList>
        <Copy from="replay" to="playground" />
        <Run />
        <Clear />
      </Buttons>
      {props.children}
    </CodeBooth >
  );
};

/** Record HTML demos. */
export const HTMLRecord: React.FC<{
  /**
   * CodeMirror extensions to add.
   * @default []
   */
  extensions?: Extension[];

  /** Map of filenames to file contents. */
  files: Record<string, string>;
}> = (props) => {
  const {extensions = []} = props;

  return (
    <CodeBooth recorder={CodeRecording.recorder}>
      <FileTabs />
      {Object.keys(props.files).map(filename =>
        <EditorPanel filename={filename} key={filename}>
          <Record content={props.files[filename]} extensions={[basicSetup, extensionFromFilename(filename), ...extensions]} />
        </EditorPanel>
      )}
      <Resize />
      <Resize dir="ns" />
      <HTMLPreview />
      <Console />
      <Buttons>
        <Run />
        <Clear />
      </Buttons>
    </CodeBooth >
  );
};

/** Preview of HTML document. */
export function HTMLPreview() {
  const store = useBoothStore();

  /** <iframe> containing preview document */
  const iframe = useRef<HTMLIFrameElement>();

  /* rendering */
  useEffect(() => {
    /* re-render */
    function render() {
      const files = getFileContents(store.getState());
      if (!("index.html" in files)) {
        return;
      }
      iframe.current.srcdoc = transform(files["index.html"], files);
    }

    // initial render
    render();

    /* unsubscriptions */
    const unsubs: (() => void)[] = [];

    /* messaging */
    function update(msg: MessageEvent) {
      if (msg.data.type === "console.log") {
        store.setState(prev => ({
          ...prev,
          messages: prev.messages.concat(<pre key={Math.random()}>{msg.data.content.map((item: unknown) => formatLog(item))}</pre>)
        }));
      } else if (msg.data.type === "console.clear") {
        store.setState(prev => ({
          ...prev,
          messages: []
        }));
      }
    }

    window.addEventListener("message", update);
    unsubs.push(() => {
      window.removeEventListener("message", update);
    });

    // subscribe to run event
    unsubs.push(store.subscribe(state => state.run, () => {
      render();
      // iframe.current.contentWindow.postMessage({
      //   type: "update-css",
      //   filename: file.filename,
      //   content
      // }, "*");
    }));

    // unsubscribe
    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, []);

  return (
    <iframe className="lqv-preview" ref={iframe} sandbox="allow-popups allow-scripts" />
  );
}

/**
 * Inlines scripts and stylesheets in HTML code.
 * @param html HTML code to transform
 * @param files Map of file
 * @returns Transformed HTML code.
 */
export function transform(html: string, files: Record<string, string>) {
  // transform <script>s
  html = html.replace(/<script\s*src=(['"])(?:\.\/)?([^\1]+?\.js)\1\s*><\/script>/gi, (match, q, src) => {
    if (src in files) {
      return "<script>" + files[src] + "</script>";
    }
    return match;
  });

  // transform <link>s
  html = html.replace(/<link([^>]+?)>/gi, (match, attrs) => {
    const $_ = attrs.match(/href=(['"])(?:\.\/)?([^\1]+?\.css)\1/);
    if ($_) {
      const href = $_[2];
      if (href in files) {
        return `<style data-filename="${href}">` + files[href] + "</style>";
      }
      return match;
    }
    return match;
  });

  // magic scripts
  html = html.replace("<head>", "<head>" + magicScripts);

  // return
  return html;
}

/** Iframe client code for development magic */
const magicScripts = String.raw`<script>
/* update CSS without reloading */
window.addEventListener("message", ({data}) => {
  if (data.type === "update-css") {
    document.querySelector("style[data-filename='" + data.filename + "']").textContent = data.content;
  }
});

/* intercept console.log */
{
  const log = console.log;
  console.log = function(...args) {
    try {
      window.parent.postMessage({
        type: "console.log",
        content: args
      }, "*");
    } catch (e) {
      
    }
    log(...args);
  }

  const clear = console.clear;
  console.clear = function() {
    window.parent.postMessage({
      type: "console.clear"
    }, "*");
    clear();
  }
}
</script>`;

/**
 * Get CodeMirror {@link Extension} appropriate to filename extension
 * @param filename Name of file.
 * @returns Either `css()`, `html()`, or `javascript()` from `@codemirror/lang-*`.
 */
export function extensionFromFilename(filename: string): Extension {
  switch (true) {
    case filename.endsWith(".css"):
      return css();
    case filename.endsWith(".html"):
      return html();
    case filename.endsWith(".js"):
      return javascript();
  }
}

function getFileContents(state: State): Record<string, string> {
  const ret: Record<string, string> = {};
  if (!(state.groups[state.activeGroup]))
    return ret;
  const {files} = state.groups[state.activeGroup];
  for (const file of files) {
    ret[file.filename] = file.view.state.doc.toString();
  }
  return ret;
}

/** Format console logs */
function formatLog(o: unknown, formatString = false) {
  if (o instanceof Array) {
    return <span className="array" key={key()}>Array [ <ol>{o.map((entry, i) => <li key={i}>{formatLog(entry, true)}</li>)}</ol> ]</span>;
  } else if (typeof o === "object") {
    return <span className="object" key={key()}>Object &#123; <ol>{Object.keys(o).map((k, i) => <li key={i}>{k}: {formatLog((o as Record<string, unknown>)[k], true)}</li>)}</ol> &#125;</span>;
  } else if (typeof o === "number") {
    return <span className="number" key={key()}>{o}</span>;
  } else if (typeof o === "string") {
    if (formatString) {
      return <span className="string" key={key()}>&quot;{o}&quot;</span>;
    } else {
      return <span key={key()}>{o}</span>;
    }
  }
  return o.toString();
}

/** Get unique React key. */
function key() {
  return Math.random();
}

/** Component for displaying console logs. */
export function HTMLConsole() {
  const store = useBoothStore();
  const messages = useStore(store, state => state.messages);

  return (
    <section className="lqv-console">
      <output>
        {messages}
      </output>
    </section>
  );
}
