import ExpoModulesCore

public class ExpoAccessorySetupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAccessorySetup")

    Events("onChange")

    Function("hello") {
      return "Hello world! 👋"
    }

    AsyncFunction("setValueAsync") { (value: String) in
      self.sendEvent("onChange", [
        "value": value
      ])
    }
  }
}
