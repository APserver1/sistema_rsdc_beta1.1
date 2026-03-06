import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ChevronLeft } from 'lucide-react';

type DeltaLike = { ops: unknown[] };
type QuillLike = {
  getLength: () => number;
  getBounds: (index: number, length?: number) => { top: number; height: number; left: number; right: number };
  getContents: (index?: number, length?: number) => unknown;
  setContents: (delta: unknown) => void;
  root: HTMLElement;
};

const Editor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pages, setPages] = useState<Array<string | unknown>>(['']);
  const [paper, setPaper] = useState<'carta' | 'a4'>('carta');
  const [fontFamily, setFontFamily] = useState<'arial' | 'serif' | 'monospace'>('arial');
  const [fontSizePt, setFontSizePt] = useState<number>(12);
  const [topMarginPx, setTopMarginPx] = useState<number>(80);
  const [bottomMarginPx, setBottomMarginPx] = useState<number>(80);
  const quillRefs = useRef<Array<unknown>>([]);
  const pendingPaginateFromRef = useRef<number | null>(null);

  const page = useMemo(() => {
    return paper === 'carta'
      ? { width: 816, height: 1056, padding: 80 }
      : { width: 793, height: 1122, padding: 80 };
  }, [paper]);

  const contentWidth = page.width - page.padding * 2;
  const innerHeight = Math.max(200, page.height - topMarginPx - bottomMarginPx);
  const pageGap = 24;
  const totalPages = Math.max(1, pages.length);
  const canvasHeight = totalPages * page.height + (totalPages - 1) * pageGap;

  const modules = {
    toolbar: {
      container: '#doc-toolbar',
    },
  };

  const formats = ['font', 'size', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'align', 'color', 'clean'];

  const isDeltaLike = (value: unknown): value is DeltaLike => {
    if (!value || typeof value !== 'object') return false;
    const v = value as { ops?: unknown };
    return Array.isArray(v.ops);
  };

  const concatDelta = (a: unknown, b: unknown): unknown => {
    if (isDeltaLike(a) && isDeltaLike(b)) return { ops: [...a.ops, ...b.ops] };
    if (isDeltaLike(a) && !b) return a;
    return b;
  };

  const getQuill = (index: number): QuillLike | null => {
    const ref = quillRefs.current[index] as unknown;
    if (!ref || typeof ref !== 'object') return null;
    const getter = ref as { getEditor?: () => unknown };
    if (typeof getter.getEditor !== 'function') return null;
    const editor = getter.getEditor();
    if (!editor || typeof editor !== 'object') return null;
    return editor as QuillLike;
  };

  const findSplitIndex = (quill: QuillLike, maxHeight: number) => {
    const len = Math.max(1, quill.getLength() - 1);
    let lo = 1;
    let hi = len;
    let best = 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const b = quill.getBounds(mid);
      const fits = b.top + b.height <= maxHeight;
      if (fits) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return Math.max(1, best);
  };

  const paginateFrom = (startIndex: number) => {
    const idx = Math.max(0, startIndex);
    const quill = getQuill(idx);
    if (!quill) return;

    setPages((prev) => {
      const next = [...prev];
      next[idx] = quill.getContents();
      return next;
    });

    let guard = 0;
    while (quill.root.scrollHeight > innerHeight && guard < 20) {
      guard += 1;
      const splitIndex = findSplitIndex(quill, innerHeight);
      const len = quill.getLength();
      const keep = quill.getContents(0, splitIndex);
      const overflow = quill.getContents(splitIndex, len - splitIndex);
      quill.setContents(keep);
      pendingPaginateFromRef.current = idx + 1;

      setPages((prev) => {
        const next = [...prev];
        next[idx] = keep;
        if (idx + 1 >= next.length) next.push('');
        next[idx + 1] = concatDelta(overflow, next[idx + 1]);
        return next;
      });
    }
  };

  useEffect(() => {
    pendingPaginateFromRef.current = 0;
  }, [innerHeight, paper, fontFamily, fontSizePt]);

  useEffect(() => {
    const start = pendingPaginateFromRef.current;
    if (start === null) return;
    pendingPaginateFromRef.current = null;
    requestAnimationFrame(() => paginateFrom(start));
  }, [pages.length, innerHeight]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#05070a]">
      <div className="h-14 bg-[#0a0f1a] border-b border-white/5 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/oficios')}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h3 className="font-bold text-sm leading-tight">Editor de Documentos</h3>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">Oficio {id ?? ''}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden border-r border-white/5 relative">
          <div id="doc-toolbar" className="sticky top-0 z-10 bg-[#1a1f2e] border-b border-white/10 px-4 py-2 flex items-center gap-2">
            <select className="ql-font bg-white/5 border-none text-white text-xs rounded px-2 py-1 outline-none">
              <option value="arial" selected>Arial</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
            </select>
            <select className="ql-size bg-white/5 border-none text-white text-xs rounded px-2 py-1 outline-none">
              <option value="small">10</option>
              <option value="normal" selected>12</option>
              <option value="large">14</option>
              <option value="huge">18</option>
            </select>
            <button className="ql-color p-1 hover:bg-white/5 rounded text-white" />
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button className="ql-bold p-1 hover:bg-white/5 rounded text-white" />
            <button className="ql-italic p-1 hover:bg-white/5 rounded text-white" />
            <button className="ql-underline p-1 hover:bg-white/5 rounded text-white" />
            <button className="ql-strike p-1 hover:bg-white/5 rounded text-white" />
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button className="ql-list p-1 hover:bg-white/5 rounded text-white" value="ordered" />
            <button className="ql-list p-1 hover:bg-white/5 rounded text-white" value="bullet" />
            <div className="w-px h-4 bg-white/10 mx-1" />
            <select className="ql-align bg-white/5 border-none text-white text-xs rounded px-2 py-1 outline-none">
              <option value=""></option>
              <option value="center"></option>
              <option value="right"></option>
              <option value="justify"></option>
            </select>
            <div className="flex-1" />
            <button
              onClick={() => setPages((prev) => [...prev, ''])}
              className="px-3 py-1.5 text-[10px] font-bold rounded bg-white/5 border border-white/10 text-white hover:bg-white/10"
              title="Añadir nueva página"
            >
              Nueva página
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center bg-[#161b22] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="relative" style={{ width: `${page.width}px`, height: `${canvasHeight}px` }}>
              {pages.map((pageValue, i) => (
                <div key={i}>
                  <div
                    className="absolute left-0 bg-white shadow-2xl rounded"
                    style={{ width: `${page.width}px`, height: `${page.height}px`, top: `${i * (page.height + pageGap)}px` }}
                  />
                  <div
                    className="absolute word-editor"
                    style={{
                      left: `${page.padding}px`,
                      top: `${i * (page.height + pageGap) + topMarginPx}px`,
                      width: `${contentWidth}px`,
                      height: `${innerHeight}px`,
                      fontFamily: fontFamily === 'arial' ? 'Arial, Helvetica, sans-serif' : fontFamily,
                      fontSize: `${fontSizePt}pt`,
                      lineHeight: '1.5',
                      overflow: 'hidden'
                    }}
                  >
                    <ReactQuill
                      ref={(el) => {
                        quillRefs.current[i] = el;
                      }}
                      theme="snow"
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      value={pageValue as any}
                      onChange={(_content, _delta, source) => {
                        if (source !== 'user') return;
                        paginateFrom(i);
                      }}
                      modules={modules}
                      formats={formats}
                      placeholder={i === 0 ? 'Empiece a escribir su documento...' : ''}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-80 bg-[#0a0f1a] flex flex-col p-6 space-y-6 shrink-0 overflow-y-auto">
          <h4 className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Opciones</h4>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Tipo de papel</label>
              <select
                value={paper}
                onChange={(e) => setPaper(e.target.value as 'carta' | 'a4')}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
              >
                <option value="carta">Carta (8.5x11)</option>
                <option value="a4">A4</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Fuente</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value as 'arial' | 'serif' | 'monospace')}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
              >
                <option value="arial">Arial</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Tamaño</label>
              <input
                type="number"
                value={fontSizePt}
                min={8}
                max={24}
                onChange={(e) => setFontSizePt(parseInt(e.target.value || '12', 10))}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Margen superior</label>
              <input
                type="number"
                value={topMarginPx}
                min={0}
                max={200}
                onChange={(e) => setTopMarginPx(parseInt(e.target.value || '0', 10))}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Margen inferior</label>
              <input
                type="number"
                value={bottomMarginPx}
                min={0}
                max={200}
                onChange={(e) => setBottomMarginPx(parseInt(e.target.value || '0', 10))}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
