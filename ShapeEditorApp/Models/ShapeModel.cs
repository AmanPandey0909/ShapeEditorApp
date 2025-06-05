namespace Models
{   
    public class ShapeModel
    {
        public string Name { get; set; }
        public List<int[]> Points { get; set; }  // [ [x1,y1], [x2,y2], ... ]
        public int CenterX { get; set; }
        public int CenterY { get; set; }
    }
}
