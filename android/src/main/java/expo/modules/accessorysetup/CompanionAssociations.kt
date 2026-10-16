package expo.modules.accessorysetup

import android.bluetooth.BluetoothDevice
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.companion.AssociationInfo
import android.companion.AssociationRequest
import android.companion.BluetoothLeDeviceFilter
import android.companion.CompanionDeviceManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.os.Parcelable
import androidx.annotation.ChecksSdkIntAtLeast
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import java.util.regex.Pattern
import java.util.regex.PatternSyntaxException

/**
 * Wraps CompanionDeviceManager and hides the split between the API 33+ `AssociationInfo` APIs and
 * the older MAC-address APIs.
 */
@RequiresApi(Build.VERSION_CODES.O)
internal class CompanionAssociations(private val context: Context) {
  private val manager = context.getSystemService(CompanionDeviceManager::class.java)

  // CompanionDeviceManager doesn't keep a usable name for non-self-managed associations, and below
  // API 33 it only returns MAC addresses, so the name seen at pick time is stored here.
  private val names = context.getSharedPreferences("expo.modules.accessorysetup.names", Context.MODE_PRIVATE)

  fun associate(options: PickerOptions, callback: CompanionDeviceManager.Callback) {
    val request = buildRequest(options)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      manager.associate(request, ContextCompat.getMainExecutor(context), callback)
    } else {
      @Suppress("DEPRECATION")
      manager.associate(request, callback, Handler(Looper.getMainLooper()))
    }
  }

  fun remember(accessory: PairedAccessory) {
    names.edit { putString(accessory.macAddress, accessory.displayName) }
  }

  fun list(): List<PairedAccessory> =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      manager.myAssociations.mapNotNull(::toAccessory)
    } else {
      @Suppress("DEPRECATION")
      manager.associations.map(::fromMacAddress)
    }

  fun remove(id: String): PairedAccessory {
    val accessory: PairedAccessory
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val info = manager.myAssociations.firstOrNull { it.deviceMacAddress?.toString().equals(id, ignoreCase = true) }
        ?: throw notFound(id)
      accessory = toAccessory(info) ?: throw notFound(id)
      manager.disassociate(info.id)
    } else {
      // Addresses are case-sensitive below API 33, so pass back the stored spelling.
      @Suppress("DEPRECATION")
      val address = manager.associations.firstOrNull { it.equals(id, ignoreCase = true) } ?: throw notFound(id)
      accessory = fromMacAddress(address)
      @Suppress("DEPRECATION")
      manager.disassociate(address)
    }
    names.edit { remove(accessory.macAddress) }
    return accessory
  }

  /** Reads the association from the result of the system's association activity. */
  fun fromActivityResult(data: Intent): PairedAccessory? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val info = data.getParcelableExtra(CompanionDeviceManager.EXTRA_ASSOCIATION, AssociationInfo::class.java)
      return info?.let(::toAccessory)
    }
    @Suppress("DEPRECATION")
    return when (val device = data.getParcelableExtra<Parcelable>(CompanionDeviceManager.EXTRA_DEVICE)) {
      is ScanResult -> PairedAccessory(
        device.device.address.uppercase(),
        device.scanRecord?.deviceName ?: device.device.address.uppercase()
      )
      is BluetoothDevice -> fromMacAddress(device.address)
      else -> null
    }
  }

  @RequiresApi(Build.VERSION_CODES.TIRAMISU)
  fun toAccessory(info: AssociationInfo): PairedAccessory? {
    val macAddress = info.deviceMacAddress?.toString()?.uppercase() ?: return null
    val scannedName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      info.associatedDevice?.bleDevice?.scanRecord?.deviceName
    } else {
      null
    }
    val displayName = info.displayName?.toString() ?: scannedName ?: names.getString(macAddress, null) ?: macAddress
    return PairedAccessory(macAddress, displayName)
  }

  private fun fromMacAddress(address: String): PairedAccessory {
    val macAddress = address.uppercase()
    return PairedAccessory(macAddress, names.getString(macAddress, null) ?: macAddress)
  }

  private fun buildRequest(options: PickerOptions): AssociationRequest {
    val scanFilter = ScanFilter.Builder().apply {
      options.serviceUUID?.let { uuid ->
        val parcelUuid = try {
          ParcelUuid.fromString(uuid)
        } catch (e: IllegalArgumentException) {
          throw AccessorySetupException(AccessorySetupErrorCode.INVALID_OPTIONS, "filter.serviceUUID $uuid is not a UUID.", e)
        }
        setServiceUuid(parcelUuid)
      }
      // An empty data array matches any manufacturer data from this company.
      // TODO(verify): on a device, that an empty array matches without a mask.
      options.companyIdentifier?.let { setManufacturerData(it, ByteArray(0)) }
    }.build()

    val regex = options.namePattern ?: options.nameSubstring?.let { ".*${Pattern.quote(it)}.*" }
    val namePattern = try {
      regex?.let(Pattern::compile)
    } catch (e: PatternSyntaxException) {
      throw AccessorySetupException(AccessorySetupErrorCode.INVALID_OPTIONS, "android.namePattern is not a valid regex: ${e.description}", e)
    }

    val deviceFilter = BluetoothLeDeviceFilter.Builder()
      .setScanFilter(scanFilter)
      .apply { namePattern?.let(::setNamePattern) }
      .build()

    return AssociationRequest.Builder()
      .addDeviceFilter(deviceFilter)
      .setSingleDevice(options.singleDevice)
      .build()
  }

  private fun notFound(id: String) =
    AccessorySetupException(AccessorySetupErrorCode.NOT_FOUND, "No paired accessory has the id $id.")
}

@ChecksSdkIntAtLeast(api = Build.VERSION_CODES.O)
internal fun isCompanionDeviceSetupSupported(context: Context) =
  Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
    context.packageManager.hasSystemFeature(PackageManager.FEATURE_COMPANION_DEVICE_SETUP)
