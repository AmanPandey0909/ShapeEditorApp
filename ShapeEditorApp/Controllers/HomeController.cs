using Microsoft.AspNetCore.Mvc;

namespace ShapeEditorApp.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
