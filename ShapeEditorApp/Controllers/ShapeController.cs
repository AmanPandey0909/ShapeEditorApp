using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using OpenCvSharp;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

[ApiController]
public class ShapeController : ControllerBase
{
    public class ShapeModel
    {
        public string Name { get; set; }
        public int CenterX { get; set; }
        public int CenterY { get; set; }
        public List<int[]> Points { get; set; }
        public bool IsInner { get; set; }
    }

    [HttpPost("api/shape/detect")]
    public async Task<IActionResult> DetectShapes(IFormFile image)
    {
        if (image == null || image.Length == 0)
            return BadRequest("No image uploaded.");

        string tempPath = Path.GetTempFileName();
        using (var fs = new FileStream(tempPath, FileMode.Create))
        {
            await image.CopyToAsync(fs);
        }

        Mat mat = Cv2.ImRead(tempPath);
        System.IO.File.Delete(tempPath);

        if (mat.Empty())
            return BadRequest("Invalid image.");

        Mat gray = new Mat();
        Cv2.CvtColor(mat, gray, ColorConversionCodes.BGR2GRAY);
        Cv2.MedianBlur(gray, gray, 5);

        Mat edges = new Mat();
        Cv2.Canny(gray, edges, 50, 150);

        // Stronger edge enhancement
        Mat kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new Size(5, 5));
        Cv2.Dilate(edges, edges, kernel);
        Cv2.MorphologyEx(edges, edges, MorphTypes.Close, kernel); // clean double edges

        Cv2.FindContours(edges, out Point[][] contours, out HierarchyIndex[] hierarchy, RetrievalModes.CComp, ContourApproximationModes.ApproxSimple);

        var shapes = new List<ShapeModel>();
        int imageArea = mat.Width * mat.Height;

        for (int i = 0; i < contours.Length; i++)
        {
            var contour = contours[i];
            double area = Cv2.ContourArea(contour);

            // Skip too small or huge outer frame
            if (area < 400 || area > imageArea * 0.85)
                continue;

            // Filter very close nested shapes
            if (hierarchy[i].Parent != -1)
            {
                double parentArea = Cv2.ContourArea(contours[hierarchy[i].Parent]);
                if (Math.Abs(parentArea - area) < 200)
                    continue; // skip almost duplicate inner contour
            }

            double epsilon = 0.015 * Cv2.ArcLength(contour, true); // slightly more relaxed
            Point[] approx = Cv2.ApproxPolyDP(contour, epsilon, true);

            string type = ClassifyShape(approx, contour);

            Moments m = Cv2.Moments(contour);
            if (m.M00 == 0) continue;

            int cx = (int)(m.M10 / m.M00);
            int cy = (int)(m.M01 / m.M00);

            bool isInner = hierarchy[i].Parent != -1;

            shapes.Add(new ShapeModel
            {
                Name = type,
                CenterX = cx,
                CenterY = cy,
                Points = approx.Select(p => new[] { p.X, p.Y }).ToList(),
                IsInner = isInner
            });
        }

        return Ok(new
        {
            Width = mat.Width,
            Height = mat.Height,
            Shapes = shapes
        });
    }

    private string ClassifyShape(Point[] approx, Point[] contour)
    {
        int vertices = approx.Length;

        if (vertices == 3) return "Triangle";
        if (vertices == 4)
        {
            var rect = Cv2.BoundingRect(approx);
            double ratio = (double)rect.Width / rect.Height;
            return ratio > 0.95 && ratio < 1.05 ? "Square" : "Rectangle";
        }
        if (vertices == 5) return "Pentagon";
        if (vertices == 6) return "Hexagon";

        double area = Cv2.ContourArea(contour);
        double perimeter = Cv2.ArcLength(contour, true);
        double circularity = 4 * Math.PI * area / (perimeter * perimeter);
        if (circularity > 0.8) return "Circle";

        if (vertices > 6 && vertices <= 10) return "Polygon";

        return "Unknown";
    }
}
