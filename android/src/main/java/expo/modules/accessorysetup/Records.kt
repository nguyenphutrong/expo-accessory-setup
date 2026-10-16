package expo.modules.accessorysetup

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

internal class PickerOptions : Record {
  /** Always the 128-bit form; the JS layer expands 16- and 32-bit UUIDs. */
  @Field
  val serviceUUID: String? = null

  @Field
  val companyIdentifier: Int? = null

  @Field
  val nameSubstring: String? = null

  @Field
  val singleDevice: Boolean = true

  @Field
  val namePattern: String? = null
}

internal data class PairedAccessory(val macAddress: String, val displayName: String) {
  fun toMap() = mapOf(
    "id" to macAddress,
    "bleIdentifier" to macAddress,
    "displayName" to displayName,
    "platform" to "android"
  )
}
