require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoAccessorySetup'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: package['repository'] }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # AccessorySetupKit only exists on iOS 18+. Weak linking lets the app launch on older versions,
  # where isSupported() returns false.
  s.weak_frameworks = 'AccessorySetupKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
