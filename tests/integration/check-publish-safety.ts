import { runPublishSafetyCheck } from '../helpers/packed-artifact'

async function main(): Promise<number> {
  const label = process.env.CC_CAMOUFLAGE_PUBLISH_SAFETY_LABEL?.trim() || 'publish-safety'
  const result = await runPublishSafetyCheck(label)

  console.log('publish_safety=ok')
  console.log(`tarball=${result.tarballPath}`)
  console.log(`pack_json=${result.packJsonPath}`)
  console.log(`packed_file_count=${result.packedFiles.length}`)

  return 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
