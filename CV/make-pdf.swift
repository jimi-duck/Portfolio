// Builds the CV PDF from cv-2026.html through WebKit.
//
//   swift CV/make-pdf.swift CV/cv-2026.html CV/James_Ciclitira_Lebenslauf.pdf
//
// Why WebKit and not Chrome: Chrome's PDF output turns this font (TeX Gyre
// Heros, a CFF OpenType font) into Type 3 glyph drawings, which look heavier
// and blurrier in PDF viewers. WebKit embeds it as a real font, as the original
// Sep 2026 CV did. The page must use the installed font (~/Library/Fonts), not
// the site's woff2 files.
//
// WebKit draws at one point per CSS pixel, so the 793.7 x 1122.5 px page is
// scaled by 0.75 onto an A4 page (595.28 x 841.89 pt).

import Cocoa
import PDFKit
import WebKit

let args = CommandLine.arguments
guard args.count == 3 else { print("usage: make-pdf.swift <in.html> <out.pdf>"); exit(64) }
let htmlURL = URL(fileURLWithPath: args[1]).standardizedFileURL
let outURL = URL(fileURLWithPath: args[2]).standardizedFileURL
let cssW: CGFloat = 793.7, cssH: CGFloat = 1122.5
let a4 = CGRect(x: 0, y: 0, width: 595.2756, height: 841.8898)

struct Link { let url: URL; let rect: CGRect }   // rect in CSS px, origin top-left

func writeA4(_ data: Data, links: [Link]) {
  guard let src = PDFDocument(data: data), src.pageCount == 1, let page = src.page(at: 0) else {
    print("expected exactly one page"); exit(1)
  }
  let out = NSMutableData()
  var box = a4
  guard let consumer = CGDataConsumer(data: out as CFMutableData),
        let ctx = CGContext(consumer: consumer, mediaBox: &box, nil) else { print("no context"); exit(1) }
  ctx.beginPDFPage(nil)
  let bounds = page.bounds(for: .mediaBox)
  ctx.scaleBy(x: a4.width / bounds.width, y: a4.height / bounds.height)
  page.draw(with: .mediaBox, to: ctx)
  ctx.endPDFPage()
  ctx.closePDF()
  guard let doc = PDFDocument(data: out as Data), let a4page = doc.page(at: 0) else { print("re-read failed"); exit(1) }
  // WebKit's createPDF drops links, so add them back from the page's own <a href> boxes.
  let k = a4.width / cssW
  for l in links {
    let r = CGRect(x: l.rect.minX * k, y: a4.height - l.rect.maxY * k, width: l.rect.width * k, height: l.rect.height * k)
    let ann = PDFAnnotation(bounds: r, forType: .link, withProperties: nil)
    ann.url = l.url
    let noBorder = PDFBorder(); noBorder.lineWidth = 0
    ann.border = noBorder   // no visible box around the link
    a4page.addAnnotation(ann)
  }
  doc.documentAttributes = [
    PDFDocumentAttribute.titleAttribute: "James Ciclitira, Senior Product Designer, CV",
    PDFDocumentAttribute.authorAttribute: "James Ciclitira",
    PDFDocumentAttribute.subjectAttribute: "Senior Product Designer working where software meets hardware and real-world services, from consumer products to operational tools.",
    // Only words the CV itself says. Screening tools that read this field compare it with the text.
    PDFDocumentAttribute.keywordsAttribute: ["Senior Product Designer", "Lead Product Designer", "Product Designer", "Product Discovery", "Service Design", "User Flows", "Operational Tools", "Ops Workflows", "Problem Framing", "Product Strategy", "UX Research", "Information Architecture", "Prototyping", "Interaction Design", "UI Design", "Accessibility", "Design System", "KYC", "Figma", "Miro", "Claude Code", "ChatGPT", "AI Workflows", "Berlin"],
  ]
  guard doc.write(to: outURL) else { print("write failed"); exit(1) }
  print("wrote \(outURL.path)")
}

final class Loader: NSObject, WKNavigationDelegate {
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
      let js = "JSON.stringify([...document.querySelectorAll('a[href]')].map(a=>{const r=a.getBoundingClientRect();return {u:a.href,x:r.left,y:r.top,w:r.width,h:r.height}}))"
      webView.evaluateJavaScript(js) { value, _ in
        var links: [Link] = []
        if let s = value as? String, let d = s.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: d) as? [[String: Any]] {
          for o in arr {
            if let u = (o["u"] as? String).flatMap(URL.init(string:)),
               let x = o["x"] as? Double, let y = o["y"] as? Double, let w = o["w"] as? Double, let h = o["h"] as? Double {
              links.append(Link(url: u, rect: CGRect(x: x, y: y, width: w, height: h)))
            }
          }
        }
        let cfg = WKPDFConfiguration()
        cfg.rect = CGRect(x: 0, y: 0, width: cssW, height: cssH)
        webView.createPDF(configuration: cfg) { result in
          switch result {
          case .success(let data): writeA4(data, links: links); exit(0)
          case .failure(let e): print("pdf failed: \(e)"); exit(1)
          }
        }
      }
    }
  }
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    print("load failed: \(error)"); exit(1)
  }
}

let app = NSApplication.shared
let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: cssW, height: cssH))
let loader = Loader()
webView.navigationDelegate = loader
webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
DispatchQueue.main.asyncAfter(deadline: .now() + 30) { print("timed out"); exit(2) }
app.run()
