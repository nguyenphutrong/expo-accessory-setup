package expo.modules.accessorysetup

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAccessorySetupModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoAccessorySetup")

    Events("onChange")

    Function("hello") {
      "Hello world! 👋"
    }

    AsyncFunction("setValueAsync") { value: String ->
      sendEvent("onChange", mapOf(
        "value" to value
      ))
    }
  }
}
