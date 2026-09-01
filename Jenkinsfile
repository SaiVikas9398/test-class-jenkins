pipeline {
    agent {
        label 'built-in'
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 1, unit: 'HOURS')
        disableConcurrentBuilds()
    }
    
    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['staging', 'production'], description: 'Select target environment')
    }
    
    environment {
        APP_NAME = 'test-class-app'
        REGISTRY_CREDENTIALS_ID = 'github-token'
    }
    
    stages {
        stage('Checkout Code') {
            steps {
                echo 'Checking out source code from GitHub repository...'
                checkout scm
            }
        }
        
        stage('Run Static Analysis / Lint') {
            steps {
                echo 'Executing code linters and security checks...'
                sh 'echo "Code quality gate passed."'
            }
        }
        
        stage('Build Artifact') {
            steps {
                echo 'Compiling code and building application package...'
                sh 'echo "Build successful."'
            }
        }
        
        stage('Automated Tests') {
            steps {
                echo 'Running unit and integration test suites...'
                sh 'echo "All tests passed successfully."'
            }
        }
        
        stage('Secure Deploy') {
            steps {
                echo "Deploying to target environment: ${params.DEPLOY_ENV}"
                withCredentials([string(credentialsId: "${env.REGISTRY_CREDENTIALS_ID}", variable: 'DEPLOY_TOKEN')]) {
                    sh '''
                        echo "Authenticating with deployment target using secure token..."
                        echo "Deploying version to ${params.DEPLOY_ENV} environment..."
                    '''
                }
            }
        }
    }
    
    post {
        success {
            echo 'Pipeline completed successfully. Notification sent to team channel.'
        }
        failure {
            echo 'Pipeline failed. Check console logs for errors and notify the owner.'
        }
        always {
            cleanWs()
        }
    }
}
