package expo.modules.accessorysetup

import android.app.Activity
import android.companion.AssociationInfo
import android.companion.CompanionDeviceManager
import android.content.Context
import android.content.Intent
import android.content.IntentSender
import android.os.Build
import androidx.activity.result.IntentSenderRequest
import androidx.annotation.RequiresApi
import androidx.activity.result.contract.ActivityResultContracts.StartIntentSenderForResult
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.Serializable

private const val ACCESSORY_ADDED = "onAccessoryAdded"
private const val ACCESSORY_REMOVED = "onAccessoryRemoved"
private const val ACCESSORY_CHANGED = "onAccessoryChanged"

class ExpoAccessorySetupModule : Module() {
  private lateinit var associationLauncher: AppContextActivityResultLauncher<AssociationInput, AssociationOutput>

  // Main-thread confined: set by showPicker, completed by CompanionDeviceManager callbacks,
  // the association activity result, or the activity being destroyed.
  private var pendingAssociation: PendingAssociation? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  // Cheap to create: the system service and shared preferences are cached by the platform.
  @RequiresApi(Build.VERSION_CODES.O)
  private fun associations() = CompanionAssociations(context)

  override fun definition() = ModuleDefinition {
    Name("ExpoAccessorySetup")

    Events(ACCESSORY_ADDED, ACCESSORY_REMOVED, ACCESSORY_CHANGED)

    RegisterActivityContracts {
      associationLauncher = registerForActivityResult(AssociationContract)
    }

    Function("isSupported") {
      isCompanionDeviceSetupSupported(context)
    }

    AsyncFunction("showPicker") Coroutine { options: PickerOptions ->
      if (!isCompanionDeviceSetupSupported(context)) {
        throw unsupported()
      }
      withContext(Dispatchers.Main) { showPicker(options).toMap() }
    }

    AsyncFunction("getPairedAccessories") Coroutine { ->
      if (!isCompanionDeviceSetupSupported(context)) {
        throw unsupported()
      }
      associations().list().map(PairedAccessory::toMap)
    }

    AsyncFunction("removeAccessory") Coroutine { id: String ->
      if (!isCompanionDeviceSetupSupported(context)) {
        throw unsupported()
      }
      val accessory = associations().remove(id)
      sendEvent(ACCESSORY_REMOVED, mapOf("accessory" to accessory.toMap()))
    }

    OnActivityDestroys {
      pendingAssociation?.fail(
        AccessorySetupException(
          AccessorySetupErrorCode.UNKNOWN,
          "The activity was destroyed while the companion device picker was showing."
        )
      )
    }
  }

  private fun unsupported() = AccessorySetupException(
    AccessorySetupErrorCode.UNSUPPORTED,
    "This device doesn't support companion device setup."
  )

  @RequiresApi(Build.VERSION_CODES.O)
  private suspend fun showPicker(options: PickerOptions): PairedAccessory {
    if (pendingAssociation != null) {
      throw AccessorySetupException(
        AccessorySetupErrorCode.ALREADY_IN_PROGRESS,
        "Another companion device picker is already showing."
      )
    }
    val association = PendingAssociation()
    pendingAssociation = association
    try {
      associations().associate(options, AssociationCallback(association))
      val accessory = association.result.await()
      associations().remember(accessory)
      sendEvent(ACCESSORY_ADDED, mapOf("accessory" to accessory.toMap()))
      return accessory
    } finally {
      pendingAssociation = null
    }
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun launchAssociationActivity(association: PendingAssociation, intentSender: IntentSender) {
    if (association.activityLaunched || association.result.isCompleted) {
      return
    }
    association.activityLaunched = true
    try {
      associationLauncher.launch(AssociationInput(intentSender)) { output ->
        onAssociationActivityResult(association, output)
      }
    } catch (e: Exception) {
      association.fail(AccessorySetupException(AccessorySetupErrorCode.UNKNOWN, "Couldn't show the companion device picker.", e))
    }
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun onAssociationActivityResult(association: PendingAssociation, output: AssociationOutput) {
    if (output.resultCode != Activity.RESULT_OK) {
      association.fail(exceptionForResultCode(output.resultCode, null))
      return
    }
    val accessory = output.data?.let(associations()::fromActivityResult)
    if (accessory == null) {
      association.fail(AccessorySetupException(AccessorySetupErrorCode.UNKNOWN, "The picker returned no Bluetooth device."))
    } else {
      association.result.complete(accessory)
    }
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private inner class AssociationCallback(private val association: PendingAssociation) : CompanionDeviceManager.Callback() {
    override fun onAssociationPending(intentSender: IntentSender) {
      launchAssociationActivity(association, intentSender)
    }

    @Deprecated("Replaced by onAssociationPending on API 33")
    override fun onDeviceFound(intentSender: IntentSender) {
      launchAssociationActivity(association, intentSender)
    }

    override fun onAssociationCreated(associationInfo: AssociationInfo) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        associations().toAccessory(associationInfo)?.let(association.result::complete)
      }
    }

    override fun onFailure(errorCode: Int, error: CharSequence?) {
      association.fail(exceptionForResultCode(errorCode, error))
    }

    override fun onFailure(error: CharSequence?) {
      // From API 36 the coded overload above fires as well and carries the reason. Once the
      // association activity is showing, its result reports the outcome instead.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA || association.activityLaunched) {
        return
      }
      association.fail(
        AccessorySetupException(AccessorySetupErrorCode.UNKNOWN, error?.toString() ?: "Companion device association failed.")
      )
    }
  }
}

private class PendingAssociation {
  val result = CompletableDeferred<PairedAccessory>()
  var activityLaunched = false

  fun fail(exception: AccessorySetupException) {
    result.completeExceptionally(exception)
  }
}

private fun exceptionForResultCode(resultCode: Int, error: CharSequence?): AccessorySetupException {
  val code = when (resultCode) {
    CompanionDeviceManager.RESULT_CANCELED, CompanionDeviceManager.RESULT_USER_REJECTED ->
      AccessorySetupErrorCode.USER_CANCELLED
    CompanionDeviceManager.RESULT_DISCOVERY_TIMEOUT -> AccessorySetupErrorCode.DISCOVERY_TIMEOUT
    else -> AccessorySetupErrorCode.UNKNOWN
  }
  val message = error?.toString() ?: when (code) {
    AccessorySetupErrorCode.USER_CANCELLED -> "The user dismissed the companion device picker."
    AccessorySetupErrorCode.DISCOVERY_TIMEOUT -> "No matching device was found."
    else -> "Companion device association failed with result code $resultCode."
  }
  return AccessorySetupException(code, message)
}

/** The intent sender can't be persisted, so the activity-recreation fallback receives `null`. */
internal class AssociationInput(@Transient val intentSender: IntentSender? = null) : Serializable

internal class AssociationOutput(val resultCode: Int, val data: Intent?)

internal object AssociationContract : AppContextActivityResultContract<AssociationInput, AssociationOutput> {
  override fun createIntent(context: Context, input: AssociationInput): Intent {
    val request = IntentSenderRequest.Builder(requireNotNull(input.intentSender)).build()
    return Intent(StartIntentSenderForResult.ACTION_INTENT_SENDER_REQUEST)
      .putExtra(StartIntentSenderForResult.EXTRA_INTENT_SENDER_REQUEST, request)
  }

  override fun parseResult(input: AssociationInput, resultCode: Int, intent: Intent?) =
    AssociationOutput(resultCode, intent)
}
