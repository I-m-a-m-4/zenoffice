#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  std::panic::set_hook(Box::new(|panic_info| {
      let payload = panic_info.payload();
      let message = if let Some(s) = payload.downcast_ref::<&str>() {
          *s
      } else if let Some(s) = payload.downcast_ref::<String>() {
          &s[..]
      } else {
          "Unknown panic message"
      };

      eprintln!("\n**************************************************");
      eprintln!("ZENEVA FATAL PANIC OCCURRED!");
      eprintln!("Error: {}", message);
      if let Some(loc) = panic_info.location() {
          eprintln!("At: {}:{}:{}", loc.file(), loc.line(), loc.column());
      }
      eprintln!("**************************************************");
      // Keep console open only on panic to allow reading the error
      eprintln!("\nThe application has crashed. Please copy the error above.");
      eprintln!("Press Enter to exit...");
      let mut input = String::new();
      let _ = std::io::stdin().read_line(&mut input);
  }));

  app_lib::run();
}
