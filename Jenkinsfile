pipeline {
    agent any
    
    environment {
        APP_ENV = 'staging'
        BUILD_MESSAGE = 'Successfully completed the pipeline build!'
    }

    parameters {
        string(name: 'PERSON', defaultValue: 'Developer', description: 'Who is running this build?')
        choice(name: 'DEPLOY_ENV', choices: ['staging', 'production'], description: 'Select target environment')
    }

    options {
        timestamps()
        timeout(time: 5, unit: 'MINUTES')
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo "Hello ${params.PERSON}! Running build for environment: ${params.DEPLOY_ENV}"
                echo 'Successfully pulled code from GitHub via webhook!'
            }
        }
        stage('Run a Build Step') {
            steps {
                sh 'echo "Running build commands on EC2 instance..."'
                sh 'uname -a'
            }
        }
    }

    post {
        success {
            echo "SUCCESS! ${env.BUILD_MESSAGE}"
        }
        failure {
            echo 'FAILURE! Something went wrong in the build.'
        }
        always {
            echo 'Cleanup: This always runs at the end of the pipeline.'
        }
    }
}
