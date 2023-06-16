export interface QpdfConfig {
  version: number;
  parameters: QpdfConfigParameters;
  pages: Page[];
  pagelabels: any[];
  acroform: Acroform;
  attachments: Attachments;
  encrypt: Encrypt;
  outlines: any[];
  qpdf: [Qpdf, ObjDictionary];
}

export interface Acroform {
  fields: any[];
  hasacroform: boolean;
  needappearances: boolean;
}

export type Attachments = Record<string, string>;

export interface Encrypt {
  capabilities: Capabilities;
  encrypted: boolean;
  ownerpasswordmatched: boolean;
  parameters: EncryptParameters;
  recovereduserpassword: null;
  userpasswordmatched: boolean;
}

export interface Capabilities {
  accessibility: boolean;
  extract: boolean;
  modify: boolean;
  modifyannotations: boolean;
  modifyassembly: boolean;
  modifyforms: boolean;
  modifyother: boolean;
  printhigh: boolean;
  printlow: boolean;
}

export interface EncryptParameters {
  P: number;
  R: number;
  V: number;
  bits: number;
  filemethod: string;
  key: null;
  method: string;
  streammethod: string;
  stringmethod: string;
}

export interface Page {
  contents: string[];
  images: any[];
  label: null;
  object: string;
  outlines: any[];
  pageposfrom1: number;
}

export interface QpdfConfigParameters {
  decodelevel: string;
}

export interface Qpdf {
  jsonversion?: number;
  pdfversion?: string;
  pushedinheritedpageresources?: boolean;
  calledgetallpages?: boolean;
  maxobjectid?: number;
}

export interface ObjDictionary {
  [key: `obj:${number} ${number} R`]: Obj;
  trailer?: Trailer;
}
export interface Obj {
  value?: Value;
  stream?: Stream;
}

export interface Stream {
  datafile: string;
  dict: Dict;
}

export interface Dict {
  "/Length1"?: number;
}

export interface Value {
  "/Pages"?: string;
  "/Type"?: string;
  "/CreationDate"?: string;
  "/Creator"?: string;
  "/ModDate"?: string;
  "/Producer"?: string;
  "/Count"?: number;
  "/Kids"?: string[];
  "/Contents"?: string[];
  "/MediaBox"?: number[];
  "/Parent"?: string;
  "/Resources"?: Resources;
  "/BaseFont"?: string;
  "/DescendantFonts"?: string[];
  "/Encoding"?: string;
  "/Subtype"?: string;
  "/ToUnicode"?: string;
  "/Name"?: string;
  "/CIDSystemInfo"?: string;
  "/CIDToGIDMap"?: string;
  "/DW"?: number;
  "/FontDescriptor"?: string;
  "/W"?: W[];
  "/Ordering"?: string;
  "/Registry"?: string;
  "/Supplement"?: number;
  "/Ascent"?: number;
  "/CapHeight"?: number;
  "/Descent"?: number;
  "/Flags"?: number;
  "/FontBBox"?: number[];
  "/FontFile2"?: string;
  "/FontName"?: string;
  "/FontWeight"?: number;
  "/ItalicAngle"?: number;
  "/Leading"?: number;
  "/StemV"?: number;
  "/ID"?: string[];
  "/Info"?: string;
  "/Root"?: string;
  "/Size"?: number;
}

export interface Resources {
  "/Font": Font;
  "/ProcSet": string[];
}

export interface Font {
  "/F0"?: string;
  "/F1": string;
  "/F2"?: string;
}

export type W = number[] | number;

export interface Trailer {
  value: TrailerValue;
}

export interface TrailerValue {
  "/ID": string[];
  "/Info": string;
  "/Root": string;
  "/Size": number;
}
