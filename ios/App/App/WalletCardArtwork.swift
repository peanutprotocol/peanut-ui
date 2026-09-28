import UIKit

enum WalletCardArtwork {
    static let image: UIImage = {
        let size = CGSize(width: 160, height: 160)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            UIColor(red: 0.98, green: 0.82, blue: 0.12, alpha: 1).setFill()
            context.fill(CGRect(origin: .zero, size: size))

            UIColor.black.setFill()
            let peanut = UIBezierPath()
            peanut.move(to: CGPoint(x: 80, y: 26))
            peanut.addCurve(to: CGPoint(x: 52, y: 80), controlPoint1: CGPoint(x: 52, y: 28), controlPoint2: CGPoint(x: 42, y: 52))
            peanut.addCurve(to: CGPoint(x: 80, y: 134), controlPoint1: CGPoint(x: 62, y: 108), controlPoint2: CGPoint(x: 66, y: 134))
            peanut.addCurve(to: CGPoint(x: 108, y: 80), controlPoint1: CGPoint(x: 94, y: 134), controlPoint2: CGPoint(x: 118, y: 108))
            peanut.addCurve(to: CGPoint(x: 80, y: 26), controlPoint1: CGPoint(x: 118, y: 52), controlPoint2: CGPoint(x: 108, y: 28))
            peanut.close()
            peanut.fill()

            UIColor(red: 0.98, green: 0.82, blue: 0.12, alpha: 1).setStroke()
            let seam = UIBezierPath()
            seam.move(to: CGPoint(x: 80, y: 36))
            seam.addCurve(to: CGPoint(x: 80, y: 124), controlPoint1: CGPoint(x: 68, y: 58), controlPoint2: CGPoint(x: 92, y: 102))
            seam.lineWidth = 5
            seam.stroke()
        }
    }()
}
