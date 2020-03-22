
Pod::Spec.new do |s|
  s.name         = "RNSuperTokens"
  s.version      = "0.0.1"
  s.summary      = "SuperTokens React Native library"
  s.description  = <<-DESC
                  React Native wrapper for SuperTokens iOS library
                   DESC
  s.homepage     = "https://github.com/supertokens/supertokens-react-native"
  s.license      = "Apache 2.0"
  s.author             = { "author" => "team@supertokens.io" }
  s.platform     = :ios, "11.0"
  s.source       = { :git => "https://github.com/supertokens/supertokens-react-native.git", :tag => "master" }
  s.source_files  = "RNSuperTokens/**/*.{h,m}"
  s.requires_arc = true


  s.dependency "React"
  s.dependency "SuperTokensSession", '~> 1.0.0'
  #s.dependency "others"

end

  