
Pod::Spec.new do |s|
  s.name         = "RNSuperTokens"
  s.version      = "0.0.1"
  s.summary      = "RNSuperTokens"
  s.description  = <<-DESC
                  RNSuperTokens
                   DESC
  s.homepage     = "https://github.com/supertokens/supertokens-react-native"
  s.license      = "Apache 2.0"
  # s.license      = { :type => "MIT", :file => "FILE_LICENSE" }
  s.author             = { "author" => "team@supertokens.io" }
  s.platform     = :ios, "7.0"
  s.source       = { :git => "https://github.com/supertokens/supertokens-react-native.git", :tag => "master" }
  s.source_files  = "./**/*.{h,m}"
  s.requires_arc = true


  s.dependency "React"
  s.dependency "SuperTokensSession",'~> 1.1.0'
  #s.dependency "others"

end

  